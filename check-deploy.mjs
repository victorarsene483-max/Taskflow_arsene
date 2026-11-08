#!/usr/bin/env node
// check-deploy.mjs
// Audits the LAST COMMIT (what Render will actually build), not the files on your disk.
// Run from the project root:  node check-deploy.mjs
// It is read-only. It never prints secret values, only file names and line numbers.

import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import path from 'node:path';

// ---------- helpers ----------
const results = { pass: 0, fail: 0, warn: 0 };
const say = (level, msg) => {
  results[level]++;
  console.log(`[${level.toUpperCase()}] ${msg}`);
};
const section = (title) => console.log(`\n-- ${title}`);

const git = (...args) =>
  execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return '';
  }
};
const lines = (s) => s.split(/\r?\n/).filter(Boolean);
const stripBom = (s) => s.replace(/^\uFEFF/, '');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------- the commit under test ----------
let head;
try {
  head = git('rev-parse', 'HEAD').trim();
} catch {
  console.error('This folder is not a git repository, or it has no commits yet.');
  process.exit(1);
}
console.log(`Checking commit ${head.slice(0, 7)} (the last commit)`);

const committed = lines(git('ls-tree', '-r', '--name-only', 'HEAD')).filter(
  (f) => !f.startsWith('node_modules/'),
);
const committedSet = new Set(committed);
const lowerMap = new Map(committed.map((f) => [f.toLowerCase(), f]));
const untracked = new Set(
  lines(tryGit('ls-files', '--others', '--exclude-standard')),
);
const show = (f) => stripBom(git('show', `HEAD:${f}`));

// ---------- 1. git state ----------
section('Git state');
const untrackedList = [...untracked].filter((f) => f !== 'check-deploy.mjs');
if (untrackedList.length) {
  say(
    'warn',
    `Untracked files (not in the commit, so Render will not have them): ${untrackedList.join(', ')}`,
  );
} else {
  say('pass', 'No untracked files');
}
const dirty = lines(tryGit('status', '--porcelain')).filter(
  (l) => !l.startsWith('??'),
);
if (dirty.length) {
  say(
    'warn',
    `Uncommitted changes (not in the commit): ${dirty.map((l) => l.slice(3)).join(', ')}`,
  );
} else {
  say('pass', 'No uncommitted changes to tracked files');
}
const remoteHead = tryGit('rev-parse', 'origin/main').trim();
if (!remoteHead) {
  say('warn', 'Could not find origin/main. Is the GitHub remote set up and fetched?');
} else if (remoteHead !== head) {
  say(
    'fail',
    `HEAD (${head.slice(0, 7)}) is not what GitHub has (${remoteHead.slice(0, 7)}). Run git push, because Render builds from GitHub.`,
  );
} else {
  say('pass', 'HEAD matches origin/main');
}

// ---------- 2. package.json ----------
section('package.json');
let pkg = {};
if (!committedSet.has('package.json')) {
  say('fail', 'package.json is not in the commit');
} else {
  try {
    pkg = JSON.parse(show('package.json'));
  } catch (e) {
    say('fail', `package.json is not valid JSON: ${e.message}`);
  }
}
const scripts = pkg.scripts ?? {};
if (!scripts.start) {
  say('fail', 'No "start" script. Render runs npm start.');
} else {
  say('pass', `start script: ${scripts.start}`);
}
const entry = (scripts.start?.match(/node\s+(?:--\S+\s+)*(\S+\.m?js)/) ?? [])[1] ?? 'server.js';
if (!committedSet.has(entry)) {
  const alt = lowerMap.get(entry.toLowerCase());
  say(
    'fail',
    alt
      ? `Start file is "${entry}" but git has "${alt}" (letter case matters on Linux)`
      : `Start file "${entry}" is not in the commit`,
  );
} else {
  say('pass', `Entry file ${entry} is committed with the right case`);
}
if (pkg.type !== 'module') {
  say('warn', 'package.json has no "type": "module" (needed for import/export syntax)');
} else {
  say('pass', '"type": "module" is set');
}
if (!pkg.engines?.node) {
  say('warn', 'No "engines.node" field. Render picks its default Node version.');
} else {
  say('pass', `engines.node: ${pkg.engines.node}`);
}
const testFile = (scripts.test?.match(/(\S+\.m?js)/) ?? [])[1];
if (testFile && !committedSet.has(testFile.replace(/\\/g, '/'))) {
  say('warn', `"test" script points at ${testFile}, which is not in the commit`);
}
const deps = new Set(Object.keys(pkg.dependencies ?? {}));
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
for (const needed of ['express', 'pg']) {
  if (!deps.has(needed)) say('fail', `"${needed}" is not listed under dependencies`);
}

// ---------- 3. imports ----------
section('Imports (existence, letter case, packages)');
const specsOf = (code) => {
  const out = new Set();
  for (const m of code.matchAll(
    /(?:^|[\s;])(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  ))
    out.add(m[1]);
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.add(m[1]);
  return out;
};
const resolveRelative = (from, spec) => {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  if (committedSet.has(base)) return null;
  if (committedSet.has(`${base}.js`))
    return `${spec} needs an explicit extension (${spec}.js). Node ESM does not add it.`;
  const alt = lowerMap.get(base.toLowerCase());
  if (alt) return `letter-case mismatch: import says ${base}, git has ${alt}`;
  if (untracked.has(base)) return `${base} exists on disk but is untracked`;
  return `${base} is not in the commit`;
};

const isTestFile = (f) => /(^|\/)(tests?|__tests__)\//.test(f) || /\.test\.m?js$/.test(f);
const sourceFiles = committed.filter(
  (f) =>
    /\.(m?js|cjs)$/.test(f) &&
    !f.startsWith('public/') &&
    f !== 'check-deploy.mjs',
);
let importProblems = 0;
for (const file of sourceFiles) {
  const code = stripComments(show(file));
  for (const spec of specsOf(code)) {
    if (spec.startsWith('.')) {
      const problem = resolveRelative(file, spec);
      if (problem) {
        importProblems++;
        say('fail', `${file}: ${problem}`);
      }
    } else if (!spec.startsWith('/')) {
      if (spec.startsWith('node:')) continue;
      const name = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];
      if (builtinModules.includes(name)) continue;
      if (deps.has(name)) continue;
      importProblems++;
      if (devDeps.has(name) && !isTestFile(file)) {
        say(
          'fail',
          `${file}: imports "${name}", which is only in devDependencies (skipped when NODE_ENV=production)`,
        );
      } else if (devDeps.has(name)) {
        // test files may use devDependencies
        importProblems--;
      } else {
        say('fail', `${file}: imports "${name}", which is not in package.json`);
      }
    }
  }
}
if (!importProblems) {
  say('pass', `All imports in ${sourceFiles.length} source files resolve with the exact letter case`);
}

// ---------- 4. server entry: port and host ----------
section('Server entry file');
if (committedSet.has(entry)) {
  const code = stripComments(show(entry));
  if (/process\.env\.PORT/.test(code)) {
    say('pass', 'Reads process.env.PORT');
  } else {
    say('fail', 'Does not read process.env.PORT. Render assigns the port.');
  }
  if (/\.listen\([^)]*['"](localhost|127\.0\.0\.1)['"]/.test(code)) {
    say('fail', 'listen() is bound to localhost. Render needs the default (all interfaces).');
  }
  if (/JWT_SECRET/.test(code)) {
    say('pass', 'JWT_SECRET is checked at startup (remember to set it on Render)');
  } else {
    say('warn', 'No JWT_SECRET check found in the entry file');
  }
  if (/process\.env\.NODE_ENV/.test(code) === false && /--env-file/.test(scripts.start ?? '')) {
    say('fail', 'The start script uses --env-file, but .env is not on Render');
  }
}
if (/--env-file/.test(scripts.start ?? '')) {
  say('fail', 'The "start" script uses --env-file. Render has no .env file, so use plain "node server.js".');
}

// ---------- 5. database config ----------
section('Database config');
const poolFiles = sourceFiles.filter((f) =>
  /new\s+(pg\.)?Pool\s*\(/.test(stripComments(show(f))),
);
if (!poolFiles.length) {
  say('warn', 'Could not find where the pg Pool is created');
} else {
  for (const f of poolFiles) {
    const code = stripComments(show(f));
    if (/DATABASE_URL/.test(code)) {
      say('pass', `${f} reads DATABASE_URL`);
    } else {
      say('fail', `${f} never reads DATABASE_URL, so Render's database will be ignored`);
    }
  }
}

// ---------- 6. secrets and .env ----------
section('Secrets and .env');
const envFiles = committed.filter(
  (f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.(example|sample)$/.test(f),
);
if (envFiles.length) {
  say('fail', `Environment file committed: ${envFiles.join(', ')}`);
} else {
  say('pass', 'No .env file is committed');
}
if (!committedSet.has('.gitignore')) {
  say('fail', '.gitignore is not committed');
} else {
  const gi = show('.gitignore');
  if (!/^\/?\.env\b/m.test(gi)) say('fail', '.gitignore does not ignore .env');
  else say('pass', '.gitignore ignores .env');
  if (!/^\/?node_modules\b/m.test(gi)) say('fail', '.gitignore does not ignore node_modules');
  else say('pass', '.gitignore ignores node_modules');
}
const skipExt = /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip)$/i;
const placeholderPassword =
  /^(password|pass|yourpassword|your_password|changeme|x+|\*+|<.*>|\$\{.*)$/i;
const flaggedUrl = [];
const flaggedJwt = [];
const flaggedEmail = [];
for (const f of committed) {
  if (skipExt.test(f) || f === 'package-lock.json' || f === 'check-deploy.mjs') continue;
  let text;
  try {
    text = show(f);
  } catch {
    continue;
  }
  for (const m of text.matchAll(/postgres(?:ql)?:\/\/[^\s:'"\/@]+:([^\s@'"]+)@/g)) {
    if (!placeholderPassword.test(m[1])) {
      flaggedUrl.push(f);
      break;
    }
  }
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/.test(text)) {
    flaggedJwt.push(f);
  }
  if (/[\w.+-]+@(gmail|yahoo|outlook|hotmail|icloud|proton(mail)?)\.(com|me)/i.test(text)) {
    flaggedEmail.push(f);
  }
}
if (flaggedUrl.length) {
  say('fail', `Database URL with a real-looking password in: ${[...new Set(flaggedUrl)].join(', ')}`);
} else {
  say('pass', 'No database URL with a password in committed files');
}
if (flaggedJwt.length) {
  say('fail', `A JWT-looking token is committed in: ${[...new Set(flaggedJwt)].join(', ')}`);
} else {
  say('pass', 'No JWT-looking tokens in committed files');
}
if (flaggedEmail.length) {
  say(
    'warn',
    `Personal-looking email addresses in: ${[...new Set(flaggedEmail)].join(', ')} (the repo is public)`,
  );
} else {
  say('pass', 'No personal-looking email addresses in committed files');
}
const envHistory = lines(tryGit('log', '--all', '--oneline', '--', '.env', '.env.test'));
if (envHistory.length) {
  say('fail', `.env or .env.test appears in git history (${envHistory.length} commit(s)). Treat those secrets as leaked.`);
} else {
  say('pass', 'No .env file anywhere in git history');
}
const emailHistory = lines(
  tryGit('log', '--all', '--oneline', '-S@gmail.com', '--', 'test.rest'),
);
if (emailHistory.length) {
  say('warn', `A gmail address was added or removed in test.rest in ${emailHistory.length} commit(s) of history`);
}

// ---------- 7. frontend ----------
section('Frontend (public/)');
let frontendProblems = 0;
for (const f of committed.filter((x) => x.startsWith('public/') && /\.(html|js)$/.test(x))) {
  show(f)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/localhost|127\.0\.0\.1/.test(line)) {
        frontendProblems++;
        say('fail', `${f}:${i + 1} refers to localhost`);
      }
    });
}
if (!frontendProblems) say('pass', 'No localhost URLs in the frontend');

// ---------- 8. housekeeping ----------
section('Housekeeping');
const schemas = committed.filter((f) => /schema\.sql$/i.test(f));
if (schemas.length > 1) {
  say('warn', `More than one schema file: ${schemas.join(', ')}`);
} else if (schemas.length === 1) {
  say('pass', `Schema file: ${schemas[0]}`);
} else {
  say('warn', 'No schema.sql in the commit (you need it to load the Render database)');
}
for (const f of ['README.md', '.env.example']) {
  if (!committedSet.has(f)) say('warn', `${f} is not committed yet`);
}

// ---------- summary ----------
console.log(
  `\nSummary: ${results.pass} passed, ${results.warn} warnings, ${results.fail} failed`,
);
if (results.fail) {
  console.log('Fix every [FAIL], commit, push, then run this script again.');
  process.exit(1);
}
console.log('No failures. Review any [WARN] lines, then continue to the Render steps.');
