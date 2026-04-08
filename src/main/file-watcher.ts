import chokidar from 'chokidar';
import * as path from 'path';
import { getLatestJournalFile, tailJournalFile, parseNavRoute } from './journal';
import { stateManager } from './state';
import { AppSettings } from './types';
import { wsClient } from './ws-client';
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
      const route = parseNavRoute(journalDir);
      if (route.length > 0) {
        stateManager.setRoute(route);
        const dest = route[route.length - 1];
        const totalDist = route.reduce((acc, r) => acc + r.distanceLy, 0);
        logger.info(`Route set: ${dest.system} (${route.length} jumps, ${totalDist.toFixed(1)} ly)`);
        wsClient.sendEvent('route_set', {
          destination: dest.system,
          totalJumps: route.length,
          totalDistanceLy: totalDist,
          route,
        });
      } else {
        stateManager.clearRoute();
        logger.info('Route cleared');
        wsClient.sendEvent('route_cleared', {});
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
