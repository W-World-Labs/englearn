import { useI18n } from "@/lib/i18n/context";

export function ExamSources() {
  const { t } = useI18n();
  return (
    <details className="mt-8 text-xs leading-6 text-slate-500">
      <summary className="cursor-pointer">{t("ielts.sourcesTitle")}</summary>
      <p>
        Reading:{" "}
        <a
          className="underline"
          href="https://github.com/sifu-ewu/ielts-reading-mock-test"
        >
          sifu-ewu / ielts-reading-mock-test
        </a>{" "}
        ·{" "}
        <a className="underline" href="/ielts-assets/MIT-reading.txt">
          MIT
        </a>{" "}
        · © 2026 sifu-ewu. Adapted question format. ·{" "}
        <a className="underline" href="/ielts-assets/NOTICE.md">
          provenance
        </a>
      </p>
      <p>
        Listening:{" "}
        <a
          className="underline"
          href="https://github.com/LuchoBazz/ielts-ai-dataset/tree/cba645115e62eccabfe03cb70e9488646b57c290/datasets/practice-drills/listening/ielts-listening-band-8.0-test-001"
        >
          LuchoBazz / ielts-ai-dataset
        </a>{" "}
        ·{" "}
        <a className="underline" href="/ielts-assets/CC-BY-4.0.txt">
          CC BY 4.0
        </a>
        . © LuchoBazz. AI-generated advanced practice drill; adapted question
        format, added terminal map. Audio unchanged (sha256 in provenance). ·{" "}
        <a className="underline" href="/ielts-assets/NOTICE.md">
          provenance
        </a>
      </p>
      <p>
        Reading Practice 02:{" "}
        <a
          className="underline"
          href="https://github.com/LuchoBazz/ielts-ai-dataset/tree/78f7ebf2b430114998aae6806cb92c1a4a475594/datasets/synthetic-official-mocks/reading/ielts-reading-academic-001.json"
        >
          LuchoBazz / ielts-ai-dataset
        </a>{" "}
        ·{" "}
        <a className="underline" href="/ielts-assets/CC-BY-4.0.txt">
          CC BY 4.0
        </a>
        . © LuchoBazz. Adapted question format; one passage substituted from
        the same repository&apos;s Band 9 set. ·{" "}
        <a className="underline" href="/ielts-assets/NOTICE.md">
          provenance
        </a>
      </p>
      <p>
        Listening Practice 02: original LingoLearn scripts and recordings
        (CC BY-SA 4.0, single narrator voice). ·{" "}
        <a className="underline" href="/ielts-assets/NOTICE.md">
          provenance
        </a>
      </p>
      <p>
        Writing Practice 02: original LingoLearn tasks (CC BY-SA 4.0).
      </p>
      <p>
        Writing interaction reference:{" "}
        <a
          className="underline"
          href="https://github.com/Arittra95/computer-based-ielts-writing-test-interface"
        >
          Arittra95 / computer-based-ielts-writing-test-interface
        </a>{" "}
        (Apache-2.0; no code copied). Writing tasks authored for LingoLearn.
      </p>
      <p>
        {t("ielts.sourcesNote")}{" "}
        <a
          className="underline"
          href="https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test"
        >
          Official familiarisation resources
        </a>
      </p>
    </details>
  );
}
