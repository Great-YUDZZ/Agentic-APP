import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  RotateCw,
  FolderPlus,
  Trash2,
  Edit2,
  ExternalLink,
  FolderGit2,
  X,
  Check,
  Image as ImageIcon,
  Braces,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FileNode } from '../../types';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { EmptyState } from '../common/EmptyState';
import { CloneRepositoryModal } from './CloneRepositoryModal';
import { GitDocsModal } from './GitDocsModal';

const getFileIcon = (ext: string, isDir: boolean, isOpen: boolean) => {
  if (isDir) {
    return isOpen ? (
      <FolderOpen className="w-4 h-4 text-[#ececec] shrink-0" />
    ) : (
      <Folder className="w-4 h-4 text-[#b4b4b4] shrink-0" />
    );
  }

  const lower = ext.toLowerCase();
  switch (lower) {
    case 'rs':
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'c':
    case 'cpp':
    case 'sh':
    case 'html':
    case 'css':
      return <FileCode className="w-4 h-4 text-[#b4b4b4] shrink-0" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return <Braces className="w-4 h-4 text-[#b4b4b4] shrink-0" />;
    case 'md':
    case 'txt':
      return <FileText className="w-4 h-4 text-[#b4b4b4] shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <ImageIcon className="w-4 h-4 text-[#b4b4b4] shrink-0" />;
    default:
      return <File className="w-4 h-4 text-[#707070] shrink-0" />;
  }
};

export const WorkspaceFileTree: React.FC = () => {
  const {
    workspaceFiles,
    activeWorkspacePath,
    isWorkspaceFilesLoading,
    fetchWorkspaceFiles,
    createWorkspaceFile,
    renameWorkspaceFile,
    deleteWorkspaceFile,
    revealInFileManager,
    openFileInSidecar,
    openFileInStudioEditor,
    currentMode,
    activeAgentWorkFiles,
    activeSessionId,
    createNewSession,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [creatingPath, setCreatingPath] = useState('');
  const [renamingNode, setRenamingNode] = useState<{ oldPath: string; newName: string } | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [isNoFolderOpen, setIsNoFolderOpen] = useState(true);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaceFiles();
  }, [fetchWorkspaceFiles]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleChangeWorkspace = async () => {
    const chosen = await useStore.getState().pickAndSetWorkspaceRoot();
    if (chosen) {
      if (!useStore.getState().activeSessionId) {
        const folderName = chosen.split('/').filter(Boolean).pop() || 'Proyek Studio';
        await createNewSession(folderName, 'build');
      }
      await fetchWorkspaceFiles();
    }
  };

  const handleOpenFolderAndCreateSession = async () => {
    const chosen = await useStore.getState().pickAndSetWorkspaceRoot();
    if (chosen) {
      if (!useStore.getState().activeSessionId) {
        const folderName = chosen.split('/').filter(Boolean).pop() || 'Proyek Studio';
        await createNewSession(folderName, 'build');
      }
      await fetchWorkspaceFiles();
    }
  };

  const handleCloneSuccess = async (targetPath: string) => {
    setIsCloneModalOpen(false);
    await useStore.getState().setWorkspaceProjectRoot(targetPath);
    if (!useStore.getState().activeSessionId) {
      const folderName = targetPath.split('/').filter(Boolean).pop() || 'Proyek Kloning';
      await createNewSession(folderName, 'build');
    }
    await fetchWorkspaceFiles();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingPath.trim() || !creatingType) return;
    const ok = await createWorkspaceFile(creatingPath.trim(), creatingType === 'folder');
    if (ok) {
      setCreatingType(null);
      setCreatingPath('');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingNode || !renamingNode.newName.trim()) return;
    const oldParts = renamingNode.oldPath.split('/');
    oldParts.pop();
    const parentDir = oldParts.join('/');
    const newRelativePath = parentDir
      ? `${parentDir}/${renamingNode.newName.trim()}`
      : renamingNode.newName.trim();

    const ok = await renameWorkspaceFile(renamingNode.oldPath, newRelativePath);
    if (ok) {
      setRenamingNode(null);
    }
  };

  const handleDeleteConfirm = async (path: string) => {
    const ok = await deleteWorkspaceFile(path);
    if (ok) {
      setDeletingPath(null);
    }
  };

  // Filter pohon berkas berdasarkan kata kunci pencarian
  const filterNodes = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();

    const result: FileNode[] = [];
    for (const node of nodes) {
      if (node.is_dir) {
        const matchingChildren = node.children ? filterNodes(node.children, query) : [];
        if (node.name.toLowerCase().includes(q) || matchingChildren.length > 0) {
          result.push({
            ...node,
            children: matchingChildren.length > 0 ? matchingChildren : node.children,
          });
        }
      } else if (node.name.toLowerCase().includes(q) || node.relative_path.toLowerCase().includes(q)) {
        result.push(node);
      }
    }
    return result;
  };

  const filteredTree = useMemo(() => {
    return filterNodes(workspaceFiles, searchQuery);
  }, [workspaceFiles, searchQuery]);

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.relative_path) || searchQuery.trim().length > 0;
    const isRenaming = renamingNode?.oldPath === node.relative_path;
    const isDeleting = deletingPath === node.relative_path;
    const activeWork = activeAgentWorkFiles ? activeAgentWorkFiles[node.relative_path] : null;
    const isChildWorking =
      node.is_dir &&
      activeAgentWorkFiles &&
      Object.keys(activeAgentWorkFiles).some((p) => p.startsWith(`${node.relative_path}/`));

    return (
      <div key={node.relative_path} className="flex flex-col">
        {/* Row File / Folder */}
        <div
          style={{
            paddingLeft: `${Math.max(8, level * 14 + 8)}px`,
            backgroundColor: activeWork ? `${activeWork.avatarColor}15` : undefined,
            borderLeft: activeWork ? `2px solid ${activeWork.avatarColor}` : '2px solid transparent',
          }}
          className={`group flex items-center justify-between py-1 px-2 rounded-lg text-xs cursor-pointer transition-all duration-300 ${
            activeWork
              ? 'text-[#ececec]'
              : 'hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec]'
          }`}
          onClick={() => {
            if (node.is_dir) {
              toggleFolder(node.relative_path);
            } else {
              if (currentMode === 'build') {
                openFileInStudioEditor(node);
              } else {
                openFileInSidecar(node);
              }
            }
          }}
          title={node.relative_path}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {node.is_dir ? (
              <span className="p-0.5 rounded hover:bg-[#383838] text-[#707070]">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5" />
            )}

            {getFileIcon(node.extension, node.is_dir, isExpanded)}

            {isRenaming ? (
              <form
                onSubmit={handleRenameSubmit}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 flex-1"
              >
                <input
                  type="text"
                  value={renamingNode.newName}
                  onChange={(e) =>
                    setRenamingNode({ ...renamingNode, newName: e.target.value })
                  }
                  autoFocus
                  className="bg-[#212121] border border-[#4f4f4f] text-[#ececec] text-xs px-1.5 py-0.5 rounded outline-none w-full"
                />
                <button
                  type="submit"
                  className="p-1 hover:bg-[#383838] text-[#ececec] rounded"
                  title="Simpan nama"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingNode(null)}
                  className="p-1 hover:bg-[#383838] text-[#707070] hover:text-[#ececec] rounded"
                  title="Batal"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <span className="truncate text-xs font-sans select-none">{node.name}</span>
            )}

            {/* Badge Indikator Agen Sedang Bekerja */}
            {activeWork && (
              <div
                className="flex items-center gap-1 shrink-0 ml-1.5"
                title={`${activeWork.agentName} (${activeWork.agentRole}) sedang bekerja di berkas ini`}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-2 ring-offset-1 ring-offset-[#212121] animate-pulse"
                  style={{
                    backgroundColor: activeWork.avatarColor,
                    boxShadow: `0 0 8px ${activeWork.avatarColor}80`,
                  }}
                >
                  {activeWork.agentName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            {/* Indikator folder memuat berkas aktif agen */}
            {isChildWorking && !isExpanded && (
              <div
                className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 ml-1"
                title="Ada agen yang sedang bekerja di dalam sub-folder ini"
              />
            )}
          </div>

          {/* Action icons on hover */}
          {!isRenaming && (
            <div
              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  setRenamingNode({ oldPath: node.relative_path, newName: node.name })
                }
                title="Ganti nama"
                className="p-1 hover:bg-[#383838] text-[#707070] hover:text-[#ececec] rounded"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingPath(node.relative_path)}
                title="Hapus berkas"
                className="p-1 hover:bg-[#383838] text-[#707070] hover:text-red-400 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => revealInFileManager(node.relative_path)}
                title="Buka di file manager bawaan OS"
                className="p-1 hover:bg-[#383838] text-[#707070] hover:text-[#ececec] rounded"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Delete confirmation inline card */}
        {isDeleting && (
          <div className="mx-2 my-1 p-2 bg-[#2f2f2f] border border-red-500/30 rounded-lg text-xs space-y-1.5">
            <p className="text-red-300 font-medium">Hapus "{node.name}"?</p>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setDeletingPath(null)}
                className="px-2 py-0.5 rounded text-[11px] text-[#b4b4b4] hover:bg-[#383838]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(node.relative_path)}
                className="px-2 py-0.5 rounded text-[11px] bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        )}

        {/* Child nodes */}
        {node.is_dir && isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!activeSessionId || !activeWorkspacePath) {
    return (
      <div className="flex flex-col h-full bg-[#171717] text-[#ececec] select-none font-sans text-xs">
        {/* Accordion Header: No Folder Opened */}
        <div
          onClick={() => setIsNoFolderOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2.5 cursor-pointer hover:bg-[#212121] transition-colors font-medium text-[#cccccc]"
        >
          {isNoFolderOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          )}
          <span>No Folder Opened</span>
        </div>

        {/* Accordion Body */}
        {isNoFolderOpen && (
          <div className="px-4 py-2 space-y-3.5">
            <p className="text-xs text-[#cccccc] leading-relaxed">
              You have not yet opened a folder.
            </p>

            <button
              type="button"
              onClick={handleOpenFolderAndCreateSession}
              className="w-full py-1.5 px-3 rounded bg-[#0078d4] hover:bg-[#006cc1] text-white text-xs font-normal transition-colors text-center shadow-xs cursor-pointer"
            >
              Open Folder
            </button>

            <p className="text-xs text-[#cccccc] leading-relaxed pt-1">
              You can clone a repository locally.
            </p>

            <button
              type="button"
              onClick={() => setIsCloneModalOpen(true)}
              className="w-full py-1.5 px-3 rounded bg-[#0078d4] hover:bg-[#006cc1] text-white text-xs font-normal transition-colors text-center shadow-xs cursor-pointer"
            >
              Clone Repository
            </button>

            <p className="text-xs text-[#858585] leading-relaxed pt-2">
              To learn more about how to use Git and source control in the IDE{' '}
              <button
                type="button"
                onClick={() => setIsDocsModalOpen(true)}
                className="text-[#3794ff] hover:underline cursor-pointer inline"
              >
                read our docs
              </button>
              .
            </p>
          </div>
        )}

        {/* Modal Clone Repository */}
        {isCloneModalOpen && (
          <CloneRepositoryModal
            isOpen={isCloneModalOpen}
            onClose={() => setIsCloneModalOpen(false)}
            onSuccess={handleCloneSuccess}
          />
        )}

        {/* Modal Docs */}
        {isDocsModalOpen && (
          <GitDocsModal
            isOpen={isDocsModalOpen}
            onClose={() => setIsDocsModalOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-[#ececec] select-none">
      {/* Workspace Header Toolbar */}
      <div className="px-3 pt-2 pb-2 border-b border-[#262626] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
              Ruang Kerja
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCreatingType('file')}
              title="Buat Berkas Baru"
              className="p-1 rounded hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCreatingType('folder')}
              title="Buat Folder Baru"
              className="p-1 rounded hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fetchWorkspaceFiles()}
              title="Segarkan Berkas"
              className="p-1 rounded hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleChangeWorkspace}
              title="Ganti Direktori Workspace"
              className="p-1 rounded hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => revealInFileManager()}
              title="Buka di File Manager OS"
              className="p-1 rounded hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active directory badge */}
        <div
          className="text-[10px] text-[#707070] font-mono truncate px-1.5 py-0.5 rounded bg-[#1f1f1f] border border-[#2e2e2e]"
          title={activeWorkspacePath || 'Belum memilih direktori'}
        >
          {activeWorkspacePath ? activeWorkspacePath.split('/').slice(-2).join('/') : 'Tanpa Direktori'}
        </div>

        {/* Quick Search Bar */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#707070]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter berkas..."
            className="w-full bg-[#1f1f1f] text-[#ececec] placeholder-[#707070] text-xs pl-7 pr-7 py-1 rounded-md border border-[#2e2e2e] focus:border-[#4f4f4f] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#ececec]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Inline Create Form */}
        {creatingType && (
          <form
            onSubmit={handleCreateSubmit}
            className="p-2 bg-[#1f1f1f] border border-[#383838] rounded-lg space-y-2 mt-1"
          >
            <div className="flex items-center justify-between text-xs font-medium text-[#ececec]">
              <span>Buat {creatingType === 'folder' ? 'Folder Baru' : 'Berkas Baru'}</span>
              <button
                type="button"
                onClick={() => setCreatingType(null)}
                className="text-[#707070] hover:text-[#ececec]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={creatingPath}
              onChange={(e) => setCreatingPath(e.target.value)}
              placeholder={creatingType === 'folder' ? 'nama_folder/sub' : 'src/komponen.tsx'}
              autoFocus
              className="w-full bg-[#171717] border border-[#383838] text-xs text-[#ececec] px-2 py-1 rounded outline-none focus:border-[#4f4f4f]"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setCreatingType(null)}
                className="px-2 py-0.5 rounded text-xs text-[#b4b4b4] hover:bg-[#262626]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-2.5 py-0.5 rounded text-xs bg-[#ececec] text-[#171717] font-medium hover:bg-white"
              >
                Buat
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
        {!activeWorkspacePath ? (
          <div className="p-4 text-center">
            <EmptyState
              icon={FolderGit2}
              title="Pilih Folder Proyek"
              description="Pilih atau buka direktori tempat proyek Anda dibuat untuk membuka work tree."
              actionLabel="Pilih Folder Proyek"
              onAction={handleChangeWorkspace}
            />
          </div>
        ) : isWorkspaceFilesLoading ? (
          <div className="p-3 space-y-2">
            <LoadingSkeleton className="h-4 w-3/4" />
            <LoadingSkeleton className="h-4 w-1/2" />
            <LoadingSkeleton className="h-4 w-2/3" />
            <LoadingSkeleton className="h-4 w-4/5" />
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-4 text-center">
            <EmptyState
              icon={Folder}
              title={searchQuery ? 'Berkas Tidak Ditemukan' : 'Folder Proyek Kosong'}
              description={
                searchQuery
                  ? `Tidak ada berkas yang cocok dengan filter "${searchQuery}".`
                  : 'Belum ada berkas dalam folder proyek ini. Gunakan tombol + untuk membuat berkas baru.'
              }
            />
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};
