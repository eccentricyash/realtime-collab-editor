import { create } from 'zustand';

interface Version {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface VersionState {
  versions: Version[];
  isOpen: boolean;
  previewHtml: string | null;
  previewVersion: number | null;
  setVersions: (versions: Version[]) => void;
  setOpen: (open: boolean) => void;
  setPreview: (html: string | null, versionNumber: number | null) => void;
}

export const useVersionStore = create<VersionState>((set) => ({
  versions: [],
  isOpen: false,
  previewHtml: null,
  previewVersion: null,
  setVersions: (versions) => set({ versions }),
  setOpen: (open) => set({ isOpen: open, previewHtml: null, previewVersion: null }),
  setPreview: (html, versionNumber) => set({ previewHtml: html, previewVersion: versionNumber }),
}));
