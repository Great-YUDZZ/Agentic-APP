import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { GraphViewModal } from './GraphViewModal';
import { VaultAuditModal } from './VaultAuditModal';
import { TrashFolderModal } from './TrashFolderModal';
import { PendingApprovalsModal } from './PendingApprovalsModal';

export const VaultWorkspace: React.FC = () => {
  const {
    activeVaultTab,
    fetchPendingDeleteRequests,
    fetchTrashNotes,
  } = useStore();

  useEffect(() => {
    fetchPendingDeleteRequests();
    fetchTrashNotes();
  }, [fetchPendingDeleteRequests, fetchTrashNotes]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#212121] overflow-hidden select-none">
      <main className="flex-1 w-full h-full relative overflow-hidden bg-[#212121]">
        {activeVaultTab === 'graph' && <GraphViewModal isEmbedded />}
        {activeVaultTab === 'audit' && <VaultAuditModal isEmbedded />}
        {activeVaultTab === 'trash' && <TrashFolderModal isEmbedded />}
        {activeVaultTab === 'approvals' && <PendingApprovalsModal isEmbedded />}
      </main>
    </div>
  );
};

export default VaultWorkspace;
