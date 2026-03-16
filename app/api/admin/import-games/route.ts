import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportRow = {
  round: number;
  game_index: number;
  team_a_id: number;
  team_b_id: number;
  winner_id: number | null;
};

type ParsedRow = {
  line: number;
  round: number;
  game_index: number;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_id: number | null;
  team_a_name: string | null;
  team_b_name: string | null;
  winner_name: string | null;
};

function parseIntStrict(v: string, field: string, line: number): number {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`Line ${line}: "${field}" must be an integer`);
  return n;
}

function splitCsvLine(line: string): string[] {
  // simple CSV parser: supports quoted values
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // handle escaped quotes ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function parseCsv(csv: string): { rows: ParsedRow[]; errors: string[] } {
  const rawLines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least 1 data row."] };
  }

  const header = splitCsvLine(rawLines[0]).map((h, i) => {
    const cleaned = h.toLowerCase().trim();
    return i === 0 ? cleaned.replace(/^\ufeff/, "") : cleaned;
  });
  const idx = (name: string) => header.indexOf(name);

  const required = ["round", "game_index"];
  const missing = required.filter((c) => idx(c) === -1);
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }

  const hasTeamAId = idx("team_a_id") !== -1;
  const hasTeamBId = idx("team_b_id") !== -1;
  const hasTeamAName = idx("team_a_name") !== -1;
  const hasTeamBName = idx("team_b_name") !== -1;

  if ((!hasTeamAId && !hasTeamAName) || (!hasTeamBId && !hasTeamBName)) {
    return {
      rows: [],
      errors: [
        'CSV must include team columns using either IDs ("team_a_id,team_b_id") or names ("team_a_name,team_b_name").',
      ],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const lineNo = i + 1;
    try {
      const parts = splitCsvLine(rawLines[i]);

      const get = (col: string) => {
        const j = idx(col);
        return j >= 0 ? (parts[j] ?? "").trim() : "";
      };

      const round = parseIntStrict(get("round"), "round", lineNo);
      const game_index = parseIntStrict(get("game_index"), "game_index", lineNo);

      const teamAIdRaw = get("team_a_id");
      const teamBIdRaw = get("team_b_id");
      const teamANameRaw = get("team_a_name");
      const teamBNameRaw = get("team_b_name");

      const team_a_id =
        teamAIdRaw === "" ? null : parseIntStrict(teamAIdRaw, "team_a_id", lineNo);
      const team_b_id =
        teamBIdRaw === "" ? null : parseIntStrict(teamBIdRaw, "team_b_id", lineNo);

      const team_a_name = teamANameRaw === "" ? null : teamANameRaw;
      const team_b_name = teamBNameRaw === "" ? null : teamBNameRaw;

      if (team_a_id === null && !team_a_name) {
        throw new Error(`Line ${lineNo}: provide team_a_id or team_a_name`);
      }
      if (team_b_id === null && !team_b_name) {
        throw new Error(`Line ${lineNo}: provide team_b_id or team_b_name`);
      }

      const winnerRaw = get("winner_id");
      const winnerNameRaw = get("winner_name");
      const winner_id = winnerRaw === "" ? null : parseIntStrict(winnerRaw, "winner_id", lineNo);
      const winner_name = winnerNameRaw === "" ? null : winnerNameRaw;

      rows.push({
        line: lineNo,
        round,
        game_index,
        team_a_id,
        team_b_id,
        winner_id,
        team_a_name,
        team_b_name,
        winner_name,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
    }
  }

  return { rows, errors };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tournamentId?: number;
      csv?: string;
      dryRun?: boolean;
    };

    const tournamentId = body.tournamentId;
    const csv = body.csv ?? "";
    const dryRun = body.dryRun === true;

    if (!tournamentId || !Number.isFinite(tournamentId)) {
      return NextResponse.json({ ok: false, error: "Missing tournamentId" }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ ok: false, error: "Missing csv" }, { status: 400 });
    }

    const parsed = parseCsv(csv);
    if (parsed.errors.length) {
      return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
    }

    const needsNameResolution = parsed.rows.some(
      (r) =>
        r.team_a_id === null ||
        r.team_b_id === null ||
        r.winner_id === null ||
        !!r.team_a_name ||
        !!r.team_b_name ||
        !!r.winner_name
    );

    const teamNameToId = new Map<string, number>();
    if (needsNameResolution) {
      const teamRows = await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(eq(teams.tournamentId, tournamentId));

      for (const t of teamRows) {
        const key = normalizeName(t.name);
        if (!teamNameToId.has(key)) teamNameToId.set(key, t.id);
      }
    }

    const resolvedRows: ImportRow[] = [];
    const resolveErrors: string[] = [];

    for (const row of parsed.rows) {
      const resolveId = (
        explicitId: number | null,
        name: string | null,
        field: "team_a" | "team_b" | "winner"
      ): number | null => {
        if (explicitId !== null) return explicitId;
        if (!name) return null;

        const id = teamNameToId.get(normalizeName(name));
        if (id == null) {
          resolveErrors.push(
            `Line ${row.line}: could not resolve ${field}_name "${name}" in teams for tournament ${tournamentId}`
          );
          return null;
        }
        return id;
      };

      const teamAId = resolveId(row.team_a_id, row.team_a_name, "team_a");
      const teamBId = resolveId(row.team_b_id, row.team_b_name, "team_b");
      const winnerId = row.winner_id ?? resolveId(null, row.winner_name, "winner");

      if (teamAId === null || teamBId === null) {
        continue;
      }

      if (winnerId !== null && winnerId !== teamAId && winnerId !== teamBId) {
        resolveErrors.push(
          `Line ${row.line}: winner_id (${winnerId}) is not one of team_a_id (${teamAId}) or team_b_id (${teamBId})`
        );
        continue;
      }

      resolvedRows.push({
        round: row.round,
        game_index: row.game_index,
        team_a_id: teamAId,
        team_b_id: teamBId,
        winner_id: winnerId,
      });
    }

    if (resolveErrors.length) {
      return NextResponse.json({ ok: false, errors: resolveErrors }, { status: 400 });
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        tournamentId,
        parsedRows: parsed.rows.length,
        resolvedRows: resolvedRows.length,
      });
    }

    // Upsert using raw SQL because it's guaranteed to match your snake_case DB columns.
    // Unique key: (tournament_id, round, game_index)
    // NOTE: This requires the UNIQUE constraint from Step 1.
    let upserted = 0;

    for (const r of resolvedRows) {
      await db.execute(sql`
        insert into public.games
          (tournament_id, round, game_index, team_a_id, team_b_id, winner_id, updated_at)
        values
          (${tournamentId}, ${r.round}, ${r.game_index}, ${r.team_a_id}, ${r.team_b_id}, ${r.winner_id}, now())
        on conflict (tournament_id, round, game_index)
        do update set
          team_a_id = excluded.team_a_id,
          team_b_id = excluded.team_b_id,
          winner_id = excluded.winner_id,
          updated_at = now()
      `);
      upserted++;
    }

    return NextResponse.json({
      ok: true,
      tournamentId,
      rowsUpserted: upserted,
      parsedRows: parsed.rows.length,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[import-games] error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
