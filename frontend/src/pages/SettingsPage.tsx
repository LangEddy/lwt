import { Check, Settings2, Star } from "lucide-react";
import { useState } from "react";
import { useLanguageSettings } from "../hooks/useLanguageSettings";
import { useLanguages } from "../hooks/useLanguages";
import { useTts } from "../hooks/useTts";
import type { Language, UserLanguageSettings } from "../types";

export default function SettingsPage() {
  const {
    languages,
    loading: languagesLoading,
    toggleFavorite,
  } = useLanguages();
  const [pickedLanguageId, setPickedLanguageId] = useState("");

  const selectedLanguageId = pickedLanguageId || languages[0]?.id || "";
  const selectedLanguage = languages.find((l) => l.id === selectedLanguageId);

  const {
    settings,
    loading: settingsLoading,
    updateSettings,
  } = useLanguageSettings(selectedLanguageId || undefined);

  const settingsReady =
    Boolean(selectedLanguageId) &&
    !settingsLoading &&
    (settings === null || settings?.language_id === selectedLanguageId);

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
            onChange={(e) => setPickedLanguageId(e.target.value)}
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

        {settingsReady && selectedLanguage && (
          <LanguageSettingsForm
            key={selectedLanguageId}
            language={selectedLanguage}
            settings={settings}
            onSave={updateSettings}
          />
        )}
      </div>
    </div>
  );
}

interface LanguageSettingsFormProps {
  language: Language;
  settings: UserLanguageSettings | null;
  onSave: (payload: {
    tts_voice?: string;
    dictionary_url?: string;
  }) => Promise<UserLanguageSettings>;
}

function LanguageSettingsForm({
  language,
  settings,
  onSave,
}: LanguageSettingsFormProps) {
  const [ttsVoice, setTtsVoice] = useState(settings?.tts_voice ?? "");
  const [dictionaryUrl, setDictionaryUrl] = useState(
    settings?.dictionary_url ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { filteredVoices, supported } = useTts(language.code, ttsVoice);

  const hasChanges =
    (settings?.tts_voice ?? "") !== ttsVoice ||
    (settings?.dictionary_url ?? "") !== dictionaryUrl;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSave({ tts_voice: ttsVoice, dictionary_url: dictionaryUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
          TTS Voice
        </label>
        {supported ? (
          <select
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
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

      {error && <p className="text-[13px] text-[var(--color-red)]">{error}</p>}

      <div className="flex gap-2.5">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check size={16} />
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      </div>
    </>
  );
}
