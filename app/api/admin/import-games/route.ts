import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { games } from "@/db/schema";
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

function parseCsv(csv: string): { rows: ImportRow[]; errors: string[] } {
  const rawLines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least 1 data row."] };
  }

  const header = splitCsvLine(rawLines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const required = ["round", "game_index", "team_a_id", "team_b_id"];
  const missing = required.filter((c) => idx(c) === -1);
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }

  const rows: ImportRow[] = [];
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
      const team_a_id = parseIntStrict(get("team_a_id"), "team_a_id", lineNo);
      const team_b_id = parseIntStrict(get("team_b_id"), "team_b_id", lineNo);

      const winnerRaw = get("winner_id");
      const winner_id =
        winnerRaw === "" ? null : parseIntStrict(winnerRaw, "winner_id", lineNo);

      rows.push({ round, game_index, team_a_id, team_b_id, winner_id });
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

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        tournamentId,
        parsedRows: parsed.rows.length,
      });
    }

    // Upsert using raw SQL because it's guaranteed to match your snake_case DB columns.
    // Unique key: (tournament_id, round, game_index)
    // NOTE: This requires the UNIQUE constraint from Step 1.
    let upserted = 0;

    for (const r of parsed.rows) {
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
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[import-games] error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
