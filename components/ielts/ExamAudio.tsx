import * as React from "react";
import {
  EXAM_ID,
  isExamId,
  listeningPosition,
  sectionSeconds,
  sectionsFor,
  type ExamId,
} from "@/lib/ielts/exam";

/** Media follows the exam clock, including after refresh or a closed tab. */
export function ExamAudio({
  deadline,
  now,
  volume,
  examId = EXAM_ID,
}: {
  deadline: number;
  now: number;
  volume: number;
  examId?: ExamId;
}) {
  const audio = React.useRef<HTMLAudioElement>(null);
  const [error, setError] = React.useState(false);
  const set = isExamId(examId) ? examId : EXAM_ID;
  const position = listeningPosition(
    (now - (deadline - sectionSeconds("listening", set) * 1000)) / 1000,
    set,
  );
  const latest = React.useRef(position);
  latest.current = position;
  const src =
    position.phase === "playing"
      ? sectionsFor(set).listening.parts[position.partIndex].audio
      : undefined;

  async function play() {
    if (!audio.current || latest.current.phase !== "playing") return;
    const element = audio.current;
    try {
      element.volume = volume;
      element.currentTime = latest.current.time;
      await element.play();
      setError(false);
    } catch {
      setError(true);
    }
  }

  React.useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.volume = volume;
    if (position.phase !== "playing") {
      element.pause();
      return;
    }
    // Recover from media stalls and background timer throttling without replaying.
    if (
      element.readyState >= 1 &&
      Math.abs(element.currentTime - position.time) > 2
    )
      element.currentTime = position.time;
  }, [now, volume, position.phase, position.time]);

  return (
    <div className="text-sm leading-7" role="status">
      {src && (
        <audio
          key={src}
          ref={audio}
          src={src}
          preload="auto"
          onLoadedMetadata={() => void play()}
          onError={() => setError(true)}
          onPlaying={() => setError(false)}
        />
      )}
      <p className="font-bold">
        {position.phase === "preview"
          ? `You have ${position.remaining} seconds to read Part ${position.partIndex + 1}.`
          : position.phase === "review"
            ? `You now have ${position.remaining} seconds to check your answers.`
            : `Listening · Part ${position.partIndex + 1} of 4`}
      </p>
      {position.phase === "playing" && error && (
        <div role="alert">
          <p className="my-2">
            Audio playback was interrupted. The test clock continues; resume at
            the current position.
          </p>
          <button
            className="ielts-button"
            onClick={() =>
              audio.current?.error ? audio.current.load() : void play()
            }
          >
            Resume audio
          </button>
        </div>
      )}
    </div>
  );
}
