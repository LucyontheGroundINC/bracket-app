import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamImportRow = {
  line: number;
  region: "North" | "East" | "South" | "West";
  seed: number;
  name: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
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

function parseSeed(raw: string, line: number): number {
  const seed = Number(raw);
  if (!Number.isInteger(seed) || seed < 1 || seed > 16) {
    throw new Error(`Line ${line}: Seed must be an integer from 1 to 16.`);
  }
  return seed;
}

function parseRegion(raw: string, line: number): TeamImportRow["region"] {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "north") return "North";
  if (normalized === "east") return "East";
  if (normalized === "south") return "South";
  if (normalized === "west") return "West";
  throw new Error(`Line ${line}: Region must be one of North, East, South, West.`);
}

function normalizeHeaderCell(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function parseCsv(csv: string): { rows: TeamImportRow[]; errors: string[] } {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV must include a header row and at least 1 data row."],
    };
  }

  const header = splitCsvLine(lines[0]).map(normalizeHeaderCell);

  const indexOfAny = (candidates: string[]) =>
    candidates.map((name) => header.indexOf(name)).find((idx) => idx >= 0) ?? -1;

  const regionIdx = indexOfAny(["region", "postregion"]);
  const seedIdx = indexOfAny(["seed"]);
  const nameIdx = indexOfAny(["name", "teamname", "title"]);

  const missing: string[] = [];
  if (regionIdx < 0) missing.push("Region");
  if (seedIdx < 0) missing.push("Seed");
  if (nameIdx < 0) missing.push("Name");

  if (missing.length) {
    return {
      rows: [],
      errors: [`Missing required column(s): ${missing.join(", ")}`],
    };
  }

  const rows: TeamImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;

    try {
      const parts = splitCsvLine(lines[i]);
      const regionRaw = (parts[regionIdx] ?? "").trim();
      const seedRaw = (parts[seedIdx] ?? "").trim();
      const nameRaw = (parts[nameIdx] ?? "").trim();

      if (!nameRaw) {
        throw new Error(`Line ${lineNo}: Name is required.`);
      }

      const row: TeamImportRow = {
        line: lineNo,
        region: parseRegion(regionRaw, lineNo),
        seed: parseSeed(seedRaw, lineNo),
        name: nameRaw,
      };

      rows.push(row);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);
    }
  }

  if (rows.length !== 64) {
    errors.push(`Expected 64 data rows. Found ${rows.length}.`);
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

    const tournamentId = Number(body?.tournamentId);
    const csv = (body?.csv ?? "").trim();
    const dryRun = body?.dryRun === true;

    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ ok: false, error: "Missing tournamentId" }, { status: 400 });
    }

    if (!csv) {
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

    let upserted = 0;

    for (const row of parsed.rows) {
      await db.execute(sql`
        insert into public.teams (tournament_id, region, seed, name)
        values (${tournamentId}, ${row.region}, ${row.seed}, ${row.name})
        on conflict (tournament_id, name)
        do update set
          region = excluded.region,
          seed = excluded.seed
      `);
      upserted++;
    }

    return NextResponse.json({
      ok: true,
      tournamentId,
      rowsUpserted: upserted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[import-teams] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
