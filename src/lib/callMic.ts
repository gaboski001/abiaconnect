/**
 * Spotting a microphone that has gone silent mid-call.
 *
 * Some Android phones stop delivering sound from the microphone when the phone
 * switches into "call mode" while it is already recording. The track still
 * says it is live, but every sample is zero, so the other person hears
 * nothing. A real microphone always picks up a little sound (breathing, room
 * noise), so energy that does not grow at all is a sure sign it has stopped.
 */

/** Polls (2 s apart) of total silence before the mic is restarted: about 6 s. */
export const SILENT_POLLS_BEFORE_RESTART = 3
/** Restarts allowed per call, so a truly broken mic can't loop forever. */
export const MAX_MIC_RESTARTS = 2

export interface MicWatch {
  lastEnergy: number | null
  silentPolls: number
  restarts: number
}

export const freshMicWatch = (): MicWatch => ({ lastEnergy: null, silentPolls: 0, restarts: 0 })

/**
 * One stats reading. `energy` is the microphone's totalAudioEnergy (null when
 * the browser doesn't report it). Returns the new watch state and whether to
 * restart the microphone now.
 */
export function watchMic(
  watch: MicWatch,
  reading: { energy: number | null; muted: boolean; connected: boolean },
): { watch: MicWatch; restart: boolean } {
  // Muted on purpose, not in a call yet, or no data: nothing to judge.
  if (!reading.connected || reading.muted || reading.energy == null) {
    return { watch: { ...watch, lastEnergy: reading.energy, silentPolls: 0 }, restart: false }
  }
  const silent = watch.lastEnergy != null && reading.energy <= watch.lastEnergy
  const silentPolls = silent ? watch.silentPolls + 1 : 0
  if (silentPolls >= SILENT_POLLS_BEFORE_RESTART && watch.restarts < MAX_MIC_RESTARTS) {
    return {
      watch: { lastEnergy: null, silentPolls: 0, restarts: watch.restarts + 1 },
      restart: true,
    }
  }
  return { watch: { ...watch, lastEnergy: reading.energy, silentPolls }, restart: false }
}
