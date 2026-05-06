import { Check, Settings2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguageSettings } from "../hooks/useLanguageSettings";
import { useLanguages } from "../hooks/useLanguages";
import { useTts } from "../hooks/useTts";

export default function SettingsPage() {
  const {
    languages,
    loading: languagesLoading,
    toggleFavorite,
  } = useLanguages();
  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const selectedLanguage = useMemo(
    () => languages.find((l) => l.id === selectedLanguageId),
    [languages, selectedLanguageId],
  );

  useEffect(() => {
    if (!selectedLanguageId && languages.length > 0) {
      setSelectedLanguageId(languages[0].id);
    }
  }, [languages, selectedLanguageId]);

  const {
    settings,
    loading: settingsLoading,
    updateSettings,
  } = useLanguageSettings(selectedLanguageId || undefined);

  const { filteredVoices, supported } = useTts(
    selectedLanguage?.code,
    settings?.tts_voice,
  );

  const [ttsVoice, setTtsVoice] = useState("");
  const [dictionaryUrl, setDictionaryUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTtsVoice(settings?.tts_voice ?? "");
    setDictionaryUrl(settings?.dictionary_url ?? "");
  }, [settings?.tts_voice, settings?.dictionary_url, selectedLanguageId]);

  const hasChanges =
    (settings?.tts_voice ?? "") !== ttsVoice ||
    (settings?.dictionary_url ?? "") !== dictionaryUrl;

  const handleSave = async () => {
    if (!selectedLanguageId) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSettings({
        tts_voice: ttsVoice,
        dictionary_url: dictionaryUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 pb-6 overflow-y-auto">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <Settings2 size={20} />
            Language Settings
          </h2>
          <p className="text-[14px] text-[var(--color-text2)] mt-1">
            Configure per-language TTS voice and dictionary template. Use{" "}
            {"{word}"} as placeholder.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Language
          </label>
          <select
            value={selectedLanguageId}
            onChange={(e) => setSelectedLanguageId(e.target.value)}
            disabled={languagesLoading}
            className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors cursor-pointer"
          >
            <option value="" disabled>
              Select language…
            </option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {selectedLanguage && (
          <button
            type="button"
            onClick={() =>
              toggleFavorite(selectedLanguage.id, !selectedLanguage.is_favorite)
            }
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-semibold hover:bg-[var(--color-bg)] transition-colors"
          >
            <Star
              size={14}
              className={
                selectedLanguage.is_favorite
                  ? "fill-[var(--color-amber)] text-[var(--color-amber)]"
                  : "text-[var(--color-text3)]"
              }
            />
            {selectedLanguage.is_favorite ? "In Chosen" : "Add to Chosen"}
          </button>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            TTS Voice
          </label>
          {supported ? (
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              disabled={settingsLoading}
              className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors cursor-pointer"
            >
              <option value="">Browser default</option>
              {filteredVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] text-[var(--color-text3)]">
              Browser TTS is not supported on this device.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Dictionary URL Template
          </label>
          <input
            value={dictionaryUrl}
            onChange={(e) => setDictionaryUrl(e.target.value)}
            placeholder="https://www.wordreference.com/es/en/translation.asp?tranword={word}"
            className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
          />
          <p className="text-[12px] text-[var(--color-text3)]">
            Use {"{word}"} where the selected word should be injected.
          </p>
        </div>

        {error && (
          <p className="text-[13px] text-[var(--color-red)]">{error}</p>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={handleSave}
            disabled={saving || !selectedLanguageId || !hasChanges}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check size={16} />
            {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
