import { createUIStore } from './ui-store.js';

describe('createUIStore', () => {
  it('should have correct initial state', () => {
    const store = createUIStore();
    const state = store.getState();

    expect(state.selectedFieldId).toBeNull();
    expect(state.mode).toBe('build');
    expect(state.editTab).toBe('edit');
    expect(state.editModalOpen).toBe(false);
  });

  it('should select a field and reset editTab', () => {
    const store = createUIStore();
    store.getState().setEditTab('logic');
    store.getState().selectField('field-1');

    const state = store.getState();
    expect(state.selectedFieldId).toBe('field-1');
    expect(state.editTab).toBe('edit');
  });

  it('should clear selection via null', () => {
    const store = createUIStore();
    store.getState().selectField('field-1');
    store.getState().selectField(null);

    expect(store.getState().selectedFieldId).toBeNull();
  });

  it('should set mode', () => {
    const store = createUIStore();
    store.getState().setMode('preview');

    expect(store.getState().mode).toBe('preview');
  });

  it('should set edit tab', () => {
    const store = createUIStore();
    store.getState().setEditTab('logic');

    expect(store.getState().editTab).toBe('logic');
  });

  it('should toggle edit modal', () => {
    const store = createUIStore();
    store.getState().setEditModalOpen(true);

    expect(store.getState().editModalOpen).toBe(true);

    store.getState().setEditModalOpen(false);

    expect(store.getState().editModalOpen).toBe(false);
  });
});
