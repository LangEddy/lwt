import { useCallback, useEffect, useMemo, useState } from "react";

export function useTts(languageCode?: string, preferredVoice?: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const filteredVoices = useMemo(() => {
    if (!languageCode) return voices;
    const code = languageCode.toLowerCase();
    const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(code));
    return matches.length > 0 ? matches : voices;
  }, [languageCode, voices]);

  const resolveVoice = useCallback(
    (overrideVoice?: string) => {
      const wanted = (overrideVoice || preferredVoice || "").trim();
      if (!wanted) return undefined;
      return voices.find((v) => v.voiceURI === wanted || v.name === wanted);
    },
    [preferredVoice, voices],
  );

  const speak = useCallback(
    (text: string, overrideVoice?: string) => {
      if (!("speechSynthesis" in window) || !text.trim()) return false;

      const utterance = new SpeechSynthesisUtterance(text.trim());
      if (languageCode) {
        utterance.lang = languageCode;
      }
      const resolvedVoice = resolveVoice(overrideVoice);
      if (resolvedVoice) {
        utterance.voice = resolvedVoice;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [languageCode, resolveVoice],
  );

  return {
    supported: "speechSynthesis" in window,
    voices,
    filteredVoices,
    speak,
  };
}
