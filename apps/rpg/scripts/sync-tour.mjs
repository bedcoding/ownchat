import { config as loadEnvironment } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DOCUMENT = path.join(APP_DIR, 'data', 'local', 'tour.json');

loadEnvironment({ path: path.join(APP_DIR, '.env.local'), quiet: true });

const documentPath = path.resolve(process.argv[2] || DEFAULT_DOCUMENT);
const slug = process.argv[3] || 'default';
const connectionString = process.env.DATABASE_URL?.trim();
const schema = process.env.DATABASE_SCHEMA?.trim() || 'ownchat';

if (!connectionString) {
  console.error('DATABASE_URL is missing. Add it to apps/rpg/.env.local.');
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
  console.error('DATABASE_SCHEMA may contain only letters, numbers, and underscores.');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
  console.error('Tour slug may contain only letters, numbers, underscores, and hyphens.');
  process.exit(1);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeTourDocument(value) {
  return (
    isObject(value) &&
    isObject(value.work) &&
    typeof value.work.id === 'string' &&
    Array.isArray(value.work.episodes) &&
    isObject(value.sceneState) &&
    value.sceneState.workId === value.work.id &&
    isObject(value.probeState) &&
    value.probeState.workId === value.work.id &&
    isObject(value.probeDemo) &&
    Array.isArray(value.probeDemo.log) &&
    typeof value.probeDemo.reply === 'string'
  );
}

function looksLikeWork(value) {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isObject(value.stats) &&
    Array.isArray(value.characters) &&
    Array.isArray(value.episodes)
  );
}

/** 관리자 화면이 내보낸 Work JSON도 바로 투어 문서로 올릴 수 있게 기본 상태를 만든다. */
function documentFromWork(work) {
  const firstEpisode = work.episodes[0];
  const sceneNode = firstEpisode?.nodes?.find((node) => node.id === firstEpisode.entry);
  let probeEpisode;
  let probeNode;
  for (const episode of work.episodes) {
    const candidate = episode.nodes?.find((node) => node.probe);
    if (candidate) {
      probeEpisode = episode;
      probeNode = candidate;
      break;
    }
  }
  if (!firstEpisode || !sceneNode) {
    throw new Error('The work needs a valid first episode entry node.');
  }
  if (!probeEpisode || !probeNode) {
    throw new Error('The work needs at least one probe node for the AI tour step.');
  }

  const baseState = (episodeIndex, nodeId) => ({
    workId: work.id,
    episodeIndex,
    nodeId,
    stats: { ...work.stats },
    flags: [],
    items: [],
    revealed: work.characters.slice(0, 2).map((character) => character.id),
    log: [],
    endings: [],
  });
  const who = probeNode.probe.who || '등장인물';
  return {
    work,
    sceneState: baseState(firstEpisode.index, sceneNode.id),
    probeState: baseState(probeEpisode.index, probeNode.id),
    probeDemo: {
      log: [
        { role: 'user', text: '지금까지 확인한 내용을 설명해 주세요.' },
        {
          role: 'assistant',
          text: `${who}은(는) 자신이 기억하는 범위에서 차분히 상황을 설명했다.`,
        },
      ],
      reply: `${who}은(는) 질문을 듣고 알고 있는 사실을 순서대로 설명했다.`,
    },
  };
}

let document;
try {
  const parsed = JSON.parse(await fs.readFile(documentPath, 'utf8'));
  document = looksLikeTourDocument(parsed)
    ? parsed
    : looksLikeWork(parsed)
      ? documentFromWork(parsed)
      : parsed;
} catch (error) {
  console.error(`Could not read tour document: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}

if (!looksLikeTourDocument(document)) {
  console.error('Tour JSON must contain work, sceneState, probeState, and probeDemo.');
  process.exit(1);
}

const sslMode = process.env.DATABASE_SSL?.trim().toLowerCase();
const ssl =
  sslMode === 'disable'
    ? false
    : sslMode === 'require'
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined;

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  application_name: 'ownchat-rpg-tour-sync',
  ...(ssl === undefined ? {} : { ssl }),
});

const quotedSchema = `"${schema}"`;
try {
  const result = await pool.query(
    `INSERT INTO ${quotedSchema}.tour_documents
       (slug, status, version, content, published_at)
     VALUES ($1, 'published', 1, $2::jsonb, now())
     ON CONFLICT (slug) DO UPDATE SET
       status = 'published',
       version = tour_documents.version + 1,
       content = EXCLUDED.content,
       updated_at = now(),
       published_at = now()
     RETURNING version`,
    [slug, JSON.stringify(document)],
  );
  console.log(`Published tour '${slug}' at revision ${result.rows[0].version}.`);
} catch (error) {
  console.error(`Tour sync failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
