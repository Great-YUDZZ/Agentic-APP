import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookmarkPlus,
  X,
  Plus,
  Link2,
  Check,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  searchVaultNotes,
  saveContextToVaultWithBidirectionalLinks,
  VaultSaveResult,
} from '../../utils/vaultHelper';
import { ScoredSearchResult } from '../../types';

interface SaveToVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialSummary?: string;
  onSaved?: (result: VaultSaveResult) => void;
}

export const SaveToVaultModal: React.FC<SaveToVaultModalProps> = ({
  isOpen,
  onClose,
  initialTitle = '',
  initialSummary = '',
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['konteks', 'chat']);
  const [candidateNotes, setCandidateNotes] = useState<ScoredSearchResult[]>([]);
  const [selectedRelatedNotes, setSelectedRelatedNotes] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inisialisasi data modal saat dibuka
  useEffect(() => {
    if (isOpen) {
      // Buat default title jika kosong
      let suggestedTitle = initialTitle.trim();
      if (!suggestedTitle && initialSummary) {
        const firstLine = initialSummary.split('\n')[0].replace(/^[#\s*-]+/, '').trim();
        suggestedTitle = firstLine.slice(0, 40) || 'Catatan Percakapan';
      }
      setTitle(suggestedTitle || 'Catatan Konteks');
      setSummary(initialSummary.trim());
      setTags(['konteks', 'chat']);
      setSelectedRelatedNotes([]);
      setErrorMessage(null);
      setIsPreviewOpen(false);

      // Cari catatan terkait di Vault
      performVaultSearch(suggestedTitle || initialSummary.slice(0, 50));
    }
  }, [isOpen, initialTitle, initialSummary]);

  const performVaultSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchVaultNotes(queryText, 6);
      setCandidateNotes(results);
      // Otomatis centang 2 catatan paling relevan jika ada skor tinggi
      const topMatches = results.filter((r) => r.score >= 5.0).map((r) => r.title);
      setSelectedRelatedNotes(topMatches);
    } catch (err) {
      console.warn('Gagal mencari kandidat relasi vault:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const toggleRelatedNote = (noteTitle: string) => {
    if (selectedRelatedNotes.includes(noteTitle)) {
      setSelectedRelatedNotes(selectedRelatedNotes.filter((t) => t !== noteTitle));
    } else {
      setSelectedRelatedNotes([...selectedRelatedNotes, noteTitle]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMessage('Judul catatan tidak boleh kosong.');
      return;
    }
    if (!summary.trim()) {
      setErrorMessage('Ringkasan isi catatan tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await saveContextToVaultWithBidirectionalLinks({
        title: title.trim(),
        summary: summary.trim(),
        tags,
        relatedNoteTitles: selectedRelatedNotes,
      });

      if (res.success) {
        if (onSaved) {
          onSaved(res);
        }
        onClose();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-[#212121] border border-[#383838] rounded-2xl shadow-xl flex flex-col overflow-hidden text-[#ececec]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#ececec]">
                <BookmarkPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#ececec]">Simpan ke Context Vault</h3>
                <p className="text-[11px] text-[#707070]">
                  Tautkan konteks percakapan secara dua arah ke Knowledge Graph.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 text-xs bg-red-950/40 border border-red-800/60 rounded-xl text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Input Judul */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b4b4b4]">Judul Catatan</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => performVaultSearch(title)}
                placeholder="Contoh: Arsitektur Tokio IPC Nodra"
                className="w-full px-3 py-2 text-xs bg-[#2a2a2a] border border-[#383838] rounded-xl text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#525252]"
              />
            </div>

            {/* Tags / Kategori */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b4b4b4]">Tags & Kategori</label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#2a2a2a] border border-[#383838] rounded-xl min-h-[38px]">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[#333333] border border-[#444444] rounded-md text-[#d4d4d4]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-[#888888] hover:text-[#ffffff]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Tambah tag..."
                    className="w-full text-xs bg-transparent text-[#ececec] placeholder-[#666666] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="p-1 text-[#888888] hover:text-[#ececec]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bidirectional Linking: Catatan Terkait */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#b4b4b4] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#a3a3a3]" />
                  Hubungkan Catatan Terkait (Dua Arah)
                </label>
                {isSearching && (
                  <span className="text-[10px] text-[#707070] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Mencari...
                  </span>
                )}
              </div>

              <div className="p-3 bg-[#2a2a2a] border border-[#383838] rounded-xl space-y-2">
                <p className="text-[11px] text-[#707070]">
                  Pilih catatan di bawah agar saling menautkan dengan [[wikilink]]. Catatan yang dicentang akan otomatis diperbarui tautan baliknya:
                </p>

                {candidateNotes.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {candidateNotes.map((note) => {
                      const isChecked = selectedRelatedNotes.includes(note.title);
                      return (
                        <div
                          key={note.title}
                          onClick={() => toggleRelatedNote(note.title)}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                            isChecked
                              ? 'bg-[#333333] border-[#555555]'
                              : 'bg-[#262626] border-transparent hover:border-[#383838]'
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                              isChecked
                                ? 'bg-[#ececec] border-[#ececec] text-[#171717]'
                                : 'border-[#555555] bg-transparent'
                            }`}
                          >
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#ececec] truncate">
                                [[{note.title}]]
                              </span>
                              {note.tags && note.tags.length > 0 && (
                                <span className="text-[10px] text-[#888888] font-mono">
                                  #{note.tags[0]}
                                </span>
                              )}
                            </div>
                            {note.snippet && (
                              <p className="text-[10px] text-[#707070] line-clamp-1 mt-0.5">
                                {note.snippet}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center text-[11px] text-[#707070] bg-[#242424] rounded-lg">
                    {isSearching
                      ? 'Sedang mencari catatan relevan...'
                      : 'Belum ada catatan yang cocok di Vault. Catatan ini akan disimpan sebagai entri mandiri.'}
                  </div>
                )}
              </div>
            </div>

            {/* Pratinjau Teks Markdown (Collapsible) */}
            <div className="border border-[#2e2e2e] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#262626] text-xs text-[#b4b4b4] hover:text-[#ececec]"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Pratinjau Isi Catatan
                </span>
                {isPreviewOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {isPreviewOpen && (
                <div className="p-3 bg-[#1d1d1d] max-h-40 overflow-y-auto font-mono text-[11px] text-[#b4b4b4] whitespace-pre-wrap leading-relaxed">
                  {summary}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#2e2e2e] bg-[#1c1c1c]">
            <span className="text-[11px] text-[#707070]">
              {selectedRelatedNotes.length} catatan akan saling terhubung
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3.5 py-1.5 text-xs rounded-xl bg-[#262626] border border-[#383838] text-[#b4b4b4] hover:text-[#ececec] transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-medium rounded-xl bg-[#ececec] text-[#171717] hover:bg-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Simpan ke Vault
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default SaveToVaultModal;
