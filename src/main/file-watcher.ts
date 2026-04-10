import chokidar from 'chokidar';
import * as path from 'path';
import { getLatestJournalFile, tailJournalFile, parseNavRoute } from './journal';
import { stateManager } from './state';
import { AppSettings } from './types';
import { logger } from './logger';

let watcher: chokidar.FSWatcher | null = null;
let currentJournal: string | null = null;

export function startFileWatcher(settings: AppSettings): void {
  stopFileWatcher();

  const journalDir = settings.journalPath;
  if (!journalDir) return;

  logger.info(`Watching journal dir: ${journalDir}`);

  const latest = getLatestJournalFile(journalDir);
  if (latest) {
    currentJournal = latest;
    logger.info(`Tailing: ${path.basename(latest)}`);
    tailJournalFile(latest, settings);
  } else {
    logger.warn('No journal file found — waiting for Elite Dangerous to start');
  }

  // Load initial route
  const route = parseNavRoute(journalDir);
  if (route.length > 0) {
    stateManager.setRoute(route);
  }

  // Watch directory for new journal files
  watcher = chokidar.watch(journalDir, {
    ignored: (filePath: string) => {
      const base = path.basename(filePath);
      // Only watch journal files and NavRoute.json
      return !base.startsWith('Journal.') && base !== 'NavRoute.json';
    },
    ignoreInitial: true,
    depth: 0,
    usePolling: false,
  });

  watcher.on('add', (filePath: string) => {
    const base = path.basename(filePath);
    if (base.startsWith('Journal.') && base.endsWith('.log')) {
      // New journal file (new game session)
      const latest = getLatestJournalFile(journalDir);
      if (latest && latest !== currentJournal) {
        currentJournal = latest;
        logger.info(`New journal session: ${base}`);
        tailJournalFile(latest, settings);
      }
    }
  });

  watcher.on('change', (filePath: string) => {
    const base = path.basename(filePath);
    if (base === 'NavRoute.json') {
      // NavRoute.json update is also fired as a 'NavRoute' journal event which
      // handles the WS send with the full payload. Here we only update state
      // so the dashboard reflects the route even before the journal event fires.
      const route = parseNavRoute(journalDir);
      if (route.length > 0) {
        stateManager.setRoute(route);
      } else {
        stateManager.clearRoute();
      }
    }
  });
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  currentJournal = null;
}
