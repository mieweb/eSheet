import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  createFormStore,
  registerOptionsProvider,
  unregisterOptionsProvider,
  type FieldComponentProps,
  type FieldResponse,
  type OptionsProvider,
} from '@esheet/core';
import {
  AutocompleteField,
  captureAttributes,
  matchesQuery,
  parseAutocompleteItems,
  resolveResultsPath,
  responseTokenValue,
} from './AutocompleteField.js';

function renderField(
  definition: Record<string, unknown>,
  responses: Record<string, FieldResponse> = {},
  response: FieldResponse | undefined = undefined,
  form = createFormStore()
) {
  const onResponse = vi.fn((next: FieldResponse) => {
    props.response = next;
    view.rerender(<AutocompleteField {...props} />);
  });
  const setResponse = vi.fn();
  form.setState({ responses, setResponse });
  const props = {
    field: { definition: { fieldType: 'autocomplete', ...definition } },
    form,
    ui: {},
    isSelected: false,
    isPreview: true,
    isEnabled: true,
    isRequired: false,
    isSoftRequired: false,
    isReadOnly: false,
    response,
    onRemove: vi.fn(),
    onUpdate: vi.fn(),
    onResponse,
  } as unknown as FieldComponentProps;
  const view = render(<AutocompleteField {...props} />);
  return {
    form,
    unmount: view.unmount,
    updateResponse: (next: FieldResponse) => {
      props.response = next;
      view.rerender(<AutocompleteField {...props} />);
    },
    onResponse,
    setResponse,
    updateResponses: (next: Record<string, FieldResponse>) => {
      act(() =>
        form.setState({ responses: { ...form.getState().responses, ...next } })
      );
    },
  };
}

describe('AutocompleteField with an optionsSource', () => {
  afterEach(() => {
    unregisterOptionsProvider('staff');
    unregisterOptionsProvider('patients');
    unregisterOptionsProvider('localOptions');
  });

  it('searches an empty query on focus only when minQueryLength is zero', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => [
      { id: '001', value: 'First office' },
    ]);
    registerOptionsProvider('localOptions', { fetch });
    renderField({
      id: 'location',
      question: 'Location',
      minQueryLength: 0,
      optionsSource: { provider: 'localOptions' },
    });
    expect(fetch).not.toHaveBeenCalled();
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    expect(await screen.findByText('First office')).not.toBeNull();
    expect(fetch.mock.calls[0]?.[0]).toBe('');
    fireEvent.change(input, { target: { value: 'o' } });
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]?.[0]).toBe('');
  });

  it('keeps patients default min2 and does not fetch on focus or one character', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => []);
    registerOptionsProvider('patients', { fetch });
    renderField({
      id: 'patient',
      question: 'Patient',
      optionsSource: { provider: 'patients' },
    });
    const input = screen.getByRole('combobox', { name: 'Patient' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'p' } });
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'pa' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('aborts stale query results and repeats unchanged input when params change', async () => {
    let finishOld!: (
      options: Awaited<ReturnType<OptionsProvider['fetch']>>
    ) => void;
    const fetch = vi
      .fn<OptionsProvider['fetch']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockResolvedValue([{ id: 'new', value: 'New office' }]);
    registerOptionsProvider('localOptions', { fetch });
    const { onResponse, updateResponses } = renderField(
      {
        id: 'location',
        question: 'Location',
        minQueryLength: 0,
        optionsSource: {
          provider: 'localOptions',
          params: { country: '{field:country}' },
        },
      },
      { country: { answer: 'US' } },
      {
        selected: { id: 'saved', value: 'Saved office' },
        attributes: { Country: 'US' },
      }
    );
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    updateResponses({ country: { answer: 'AO' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[0]?.[2].aborted).toBe(true);
    expect(fetch.mock.calls[1]?.slice(0, 2)).toEqual([
      'Saved office',
      { country: 'AO' },
    ]);
    await act(async () => finishOld([{ id: 'old', value: 'Old office' }]));
    expect(await screen.findByText('New office')).not.toBeNull();
    expect(screen.queryByText('Old office')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('Saved office');
    expect(onResponse).not.toHaveBeenCalled();
  });

  it('ignores late results even if a provider ignores cancellation below min length', async () => {
    let finish!: (
      options: Awaited<ReturnType<OptionsProvider['fetch']>>
    ) => void;
    const fetch = vi.fn<OptionsProvider['fetch']>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    registerOptionsProvider('patients', { fetch });
    renderField({
      id: 'patient',
      question: 'Patient',
      optionsSource: { provider: 'patients' },
    });
    const input = screen.getByRole('combobox', { name: 'Patient' });
    fireEvent.change(input, { target: { value: 'pat' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'p' } });
    await act(async () => finish([{ id: 'old', value: 'Stale patient' }]));
    expect(fetch.mock.calls[0]?.[2].aborted).toBe(true);
    expect(screen.queryByText('Stale patient')).toBeNull();
    expect(screen.queryByText('Searching…')).toBeNull();
  });

  it('refetches complete providers after resolved params change', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => []);
    registerOptionsProvider('staff', { mode: 'complete', fetch });
    const { updateResponses } = renderField(
      {
        id: 'staff',
        optionsSource: {
          provider: 'staff',
          params: { realm: '{field:realm}' },
        },
      },
      { realm: { answer: 'One' } }
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    updateResponses({ realm: { answer: 'Two' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]?.slice(0, 2)).toEqual(['', { realm: 'Two' }]);
  });

  it('offers retry after provider failure without erasing a saved selection', async () => {
    const fetch = vi
      .fn<OptionsProvider['fetch']>()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue([{ id: 'new', value: 'Available office' }]);
    registerOptionsProvider('localOptions', { fetch });
    const { onResponse } = renderField(
      {
        id: 'location',
        question: 'Location',
        minQueryLength: 0,
        optionsSource: { provider: 'localOptions' },
      },
      {},
      { selected: { id: 'saved', value: 'Saved office' } }
    );
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    expect(await screen.findByRole('status')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading options' })
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect((input as HTMLInputElement).value).toBe('Saved office');
    expect(onResponse).not.toHaveBeenCalled();
  });

  it('loads a complete provider once, opens on focus and filters locally', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => [
      { id: 'wc-1', value: 'Ada Admin' },
      { id: 'wc-2', value: 'Casey Manager', attributes: { role: 'cm' } },
    ]);
    registerOptionsProvider('staff', { mode: 'complete', fetch });
    const { onResponse } = renderField({
      id: 'caseManager',
      question: 'Case manager',
      optionsSource: {
        provider: 'staff',
        params: { realm: 'Case Management' },
      },
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[1]).toEqual({ realm: 'Case Management' });

    const input = screen.getByRole('combobox', { name: 'Case manager' });
    fireEvent.focus(input);
    expect(await screen.findByText('Ada Admin')).not.toBeNull();
    expect(screen.getByText('Casey Manager')).not.toBeNull();

    fireEvent.change(input, { target: { value: 'case' } });
    await waitFor(() => expect(screen.queryByText('Ada Admin')).toBeNull());
    fireEvent.click(screen.getByText('Casey Manager'));

    expect(onResponse).toHaveBeenCalledWith({
      selected: { id: 'wc-2', value: 'Casey Manager' },
      attributes: { role: 'cm' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('resolves {field:…} params from sibling responses for a query provider', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => [
      { id: 'p1', value: 'Pat Patient', description: 'DOB 1980-01-02' },
    ]);
    registerOptionsProvider('patients', { fetch });
    renderField(
      {
        id: 'employee',
        question: 'Employee',
        minQueryLength: 1,
        optionsSource: {
          provider: 'patients',
          params: { partition: '{field:country}', site: '{field:site}' },
        },
      },
      { country: { selected: { id: 'us', value: 'United States' } } }
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Employee' }), {
      target: { value: 'pat' },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[0]).toBe('pat');
    expect(await screen.findByText('DOB 1980-01-02')).not.toBeNull();
    expect(fetch.mock.calls[0]?.[1]).toEqual({ partition: 'us' });
  });

  it('shows a legacy free-text answer until a real pick replaces it', () => {
    registerOptionsProvider('staff', {
      mode: 'complete',
      fetch: async () => [],
    });
    const { onResponse } = renderField(
      {
        id: 'caseManager',
        question: 'Case manager',
        optionsSource: { provider: 'staff' },
      },
      {},
      { answer: 'Typed Name' }
    );

    const input = screen.getByRole('combobox', { name: 'Case manager' });
    expect((input as HTMLInputElement).value).toBe('Typed Name');
    fireEvent.change(input, { target: { value: '' } });
    expect(onResponse).toHaveBeenCalledWith({
      selected: undefined,
      answer: undefined,
    });
  });

  it('keeps typed text as the answer when allowFreeText is set', () => {
    registerOptionsProvider('patients', { fetch: async () => [] });
    const { onResponse } = renderField({
      id: 'employee',
      question: 'Employee',
      allowFreeText: true,
      optionsSource: { provider: 'patients' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Employee' }), {
      target: { value: 'Marcus Webb' },
    });
    expect(onResponse).toHaveBeenLastCalledWith({
      selected: undefined,
      answer: 'Marcus Webb',
    });
  });

  it('reverts an unpicked query on blur when requireSelection is set', () => {
    registerOptionsProvider('patients', { fetch: async () => [] });
    const { onResponse } = renderField(
      {
        id: 'employee',
        question: 'Employee',
        requireSelection: true,
        allowFreeText: true, // requireSelection wins
        optionsSource: { provider: 'patients' },
      },
      {},
      { selected: { id: 'p1', value: 'Pat Patient' } }
    );
    const input = screen.getByRole('combobox', { name: 'Employee' });
    expect((input as HTMLInputElement).value).toBe('Pat Patient');

    fireEvent.change(input, { target: { value: 'Someone Else' } });
    // Typing never stores free text…
    expect(onResponse).not.toHaveBeenCalled();
    // …and blur without a pick falls back to the stored selection.
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('Pat Patient');
  });

  it('clears a leftover free-text answer on blur when requireSelection is set', () => {
    registerOptionsProvider('patients', { fetch: async () => [] });
    const { onResponse } = renderField(
      {
        id: 'employee',
        question: 'Employee',
        requireSelection: true,
        optionsSource: { provider: 'patients' },
      },
      {},
      { answer: 'Typed Name' }
    );
    const input = screen.getByRole('combobox', { name: 'Employee' });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('');
    expect(onResponse).toHaveBeenCalledWith({
      selected: undefined,
      answer: undefined,
    });
  });

  it("fills sibling fields from the picked option's attributes", async () => {
    registerOptionsProvider('patients', {
      mode: 'complete',
      fetch: async () => [
        { id: 'p1', value: 'Pat Patient', attributes: { mrn: 'EE-1' } },
      ],
    });
    const { setResponse } = renderField({
      id: 'employee',
      question: 'Employee',
      optionsSource: { provider: 'patients' },
      fillFields: { mrn: 'mrn', dateOfBirth: 'dob' },
    });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Employee' }));
    fireEvent.click(await screen.findByText('Pat Patient'));
    expect(setResponse).toHaveBeenCalledWith('mrn', { answer: 'EE-1' });
    expect(setResponse).toHaveBeenCalledWith('dob', { answer: undefined });
  });

  it('shows no results when the named provider is not registered', () => {
    renderField({
      id: 'x',
      question: 'X',
      optionsSource: { provider: 'nope' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'X' }), {
      target: { value: 'abc' },
    });
    expect(screen.queryByText('Searching…')).toBeNull();
  });

  it('never falls back to dataSourceUrl when an optionsSource is declared', () => {
    const urlFetch = vi.fn();
    vi.stubGlobal('fetch', urlFetch);
    try {
      renderField({
        id: 'x',
        question: 'X',
        optionsSource: { provider: 'nope' },
        dataSourceUrl: 'https://example.com/search?q={query}',
      });
      fireEvent.change(screen.getByRole('combobox', { name: 'X' }), {
        target: { value: 'abc' },
      });
      expect(screen.queryByText('Searching…')).toBeNull();
      expect(urlFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('restores a removed saved choice and its attributes after clearing or replacing it', async () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => [
      { id: 'new', value: 'New manager', attributes: { role: 'new' } },
    ]);
    registerOptionsProvider('staff', { mode: 'complete', fetch });
    const original = {
      selected: { id: 'old', value: 'Former manager' },
      attributes: { role: 'original' },
    };
    const { onResponse, setResponse } = renderField(
      {
        id: 'manager',
        question: 'Manager',
        optionsSource: { provider: 'staff' },
        fillFields: { role: 'role' },
      },
      {},
      original
    );
    const input = screen.getByRole('combobox', { name: 'Manager' });
    expect((input as HTMLInputElement).value).toBe('Former manager');
    fireEvent.focus(input);
    expect(await screen.findByText('No longer active')).not.toBeNull();
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.click(screen.getByText('New manager'));
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Former manager')).not.toBeNull();
    fireEvent.click(screen.getByText('Former manager'));
    expect(onResponse).toHaveBeenLastCalledWith(original);
    expect(setResponse).toHaveBeenLastCalledWith('role', {
      answer: 'original',
    });
    expect((input as HTMLInputElement).value).toBe('Former manager');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('offers local recovery below the query minimum and after unrelated typing', () => {
    const fetch = vi.fn<OptionsProvider['fetch']>(async () => []);
    registerOptionsProvider('patients', { fetch });
    const { onResponse } = renderField(
      {
        id: 'patient',
        question: 'Patient',
        requireSelection: true,
        optionsSource: { provider: 'patients' },
      },
      {},
      { selected: { id: 'closed', value: 'Closed case' } }
    );
    const input = screen.getByRole('combobox', { name: 'Patient' });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Previously selected')).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'x' } });
    expect(screen.getByText('Closed case')).not.toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onResponse).toHaveBeenLastCalledWith({
      selected: { id: 'closed', value: 'Closed case' },
      attributes: undefined,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('No longer active')).toBeNull();
  });

  it('retains new query picks when later results no longer contain them', async () => {
    const fetch = vi
      .fn<OptionsProvider['fetch']>()
      .mockResolvedValueOnce([
        { id: 'p1', value: 'Pat Patient', attributes: { mrn: 'EE-1' } },
      ])
      .mockResolvedValue([]);
    registerOptionsProvider('patients', { fetch });
    const { onResponse } = renderField({
      id: 'patient',
      question: 'Patient',
      allowFreeText: true,
      optionsSource: { provider: 'patients' },
    });
    const input = screen.getByRole('combobox', { name: 'Patient' });
    fireEvent.change(input, { target: { value: 'pat' } });
    fireEvent.click(await screen.findByText('Pat Patient'));
    fireEvent.change(input, { target: { value: 'unrelated' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Previously selected')).not.toBeNull();
    fireEvent.click(screen.getByText('Pat Patient'));
    expect(onResponse).toHaveBeenLastCalledWith({
      selected: { id: 'p1', value: 'Pat Patient' },
      attributes: { mrn: 'EE-1' },
    });
  });

  it('prefers current source labels and attributes without duplicating a saved id', async () => {
    registerOptionsProvider('staff', {
      mode: 'complete',
      fetch: async () => [
        { id: 'cm', value: 'Current name', attributes: { role: 'current' } },
      ],
    });
    const { onResponse } = renderField(
      {
        id: 'manager',
        question: 'Manager',
        optionsSource: { provider: 'staff' },
      },
      {},
      {
        selected: { id: 'cm', value: 'Old name' },
        attributes: { role: 'old' },
      }
    );
    const input = screen.getByRole('combobox', { name: 'Manager' });
    fireEvent.change(input, { target: { value: '' } });
    expect(await screen.findByText('Current name')).not.toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByText('Old name')).toBeNull();
    expect(screen.queryByText('No longer active')).toBeNull();
    fireEvent.click(screen.getByText('Current name'));
    expect(onResponse).toHaveBeenLastCalledWith({
      selected: { id: 'cm', value: 'Current name' },
      attributes: { role: 'current' },
    });
  });

  it('retains late-arriving saved selections and survives field remounts only in that form and field', () => {
    const definition = {
      id: 'manager',
      question: 'Manager',
      minQueryLength: 0,
    };
    const first = renderField(definition);
    first.updateResponse({
      selected: { id: 'former', value: 'Former manager' },
    });
    const input = screen.getByRole('combobox', { name: 'Manager' });
    expect((input as HTMLInputElement).value).toBe('Former manager');
    fireEvent.change(input, { target: { value: '' } });
    first.unmount();

    const remounted = renderField(definition, {}, undefined, first.form);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Manager' }));
    expect(screen.getByText('Former manager')).not.toBeNull();
    expect(remounted.form.getState().responses).toEqual({});
    remounted.unmount();

    const otherField = renderField(
      { ...definition, id: 'otherManager' },
      {},
      undefined,
      first.form
    );
    fireEvent.focus(screen.getByRole('combobox', { name: 'Manager' }));
    expect(screen.queryByText('Former manager')).toBeNull();
    otherField.unmount();

    renderField(definition);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Manager' }));
    expect(screen.queryByText('Former manager')).toBeNull();
  });

  it('clears local recovery when another definition is loaded', () => {
    const { form, updateResponse } = renderField(
      { id: 'manager', question: 'Manager', minQueryLength: 0 },
      {},
      { selected: { id: 'former', value: 'Former manager' } }
    );
    updateResponse({});
    act(() => form.getState().loadDefinition({ id: 'other', pages: [] }));
    const input = screen.getByRole('combobox', { name: 'Manager' });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByText('Former manager')).toBeNull();
    expect(form.getState().extensions).toEqual({});
  });

  it('does not call a failed complete provider an inactive source', async () => {
    registerOptionsProvider('staff', {
      mode: 'complete',
      fetch: async () => {
        throw new Error('Unavailable');
      },
    });
    renderField(
      {
        id: 'manager',
        question: 'Manager',
        optionsSource: { provider: 'staff' },
      },
      {},
      { selected: { id: 'former', value: 'Former manager' } }
    );
    expect(await screen.findByRole('status')).not.toBeNull();
    const input = screen.getByRole('combobox', { name: 'Manager' });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Previously selected')).not.toBeNull();
    expect(screen.queryByText('No longer active')).toBeNull();
  });

  it('preserves captured URL-source attributes for local recovery', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ label: 'Old office', id: 'old', city: 'Boston' }],
      })
      .mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetch);
    try {
      const { onResponse, setResponse } = renderField({
        id: 'office',
        question: 'Office',
        dataSourceUrl: 'https://example.com/search?q={query}',
        valueKey: 'id',
        captureKeys: ['city'],
        fillFields: { city: 'city' },
      });
      const input = screen.getByRole('combobox', { name: 'Office' });
      fireEvent.change(input, { target: { value: 'old' } });
      fireEvent.click(await screen.findByText('Old office'));
      fireEvent.change(input, { target: { value: 'another' } });
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      fireEvent.click(await screen.findByText('Old office'));
      expect(onResponse).toHaveBeenLastCalledWith({
        selected: { id: 'old', value: 'Old office' },
        attributes: { city: 'Boston' },
      });
      expect(setResponse).toHaveBeenLastCalledWith('city', {
        answer: 'Boston',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('drops a pick and its fillFields writes when the form is read-only', async () => {
    registerOptionsProvider('patients', {
      mode: 'complete',
      fetch: async () => [
        { id: 'p1', value: 'Pat Patient', attributes: { mrn: 'EE-1' } },
      ],
    });
    const { onResponse, setResponse, form } = renderField({
      id: 'employee',
      question: 'Employee',
      optionsSource: { provider: 'patients' },
      fillFields: { mrn: 'mrn' },
    });
    act(() => form.getState().setReadOnly(true));

    fireEvent.focus(screen.getByRole('combobox', { name: 'Employee' }));
    fireEvent.click(await screen.findByText('Pat Patient'));
    expect(onResponse).not.toHaveBeenCalled();
    expect(setResponse).not.toHaveBeenCalled();
  });
});

describe('responseTokenValue', () => {
  it('prefers the selected id, then the text answer', () => {
    expect(
      responseTokenValue({ selected: { id: 'us', value: 'United States' } })
    ).toBe('us');
    expect(responseTokenValue({ answer: 'free text' })).toBe('free text');
    expect(responseTokenValue({ answer: '' })).toBeUndefined();
    expect(responseTokenValue(undefined)).toBeUndefined();
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively on the display value', () => {
    const item = { id: '1', value: 'Casey Manager' };
    expect(matchesQuery(item, 'MANAG')).toBe(true);
    expect(matchesQuery(item, ' casey ')).toBe(true);
    expect(matchesQuery(item, 'ada')).toBe(false);
  });
});

describe('parseAutocompleteItems', () => {
  it('parses Wikipedia opensearch arrays using urls as ids', () => {
    const data = [
      'cat',
      ['Cat', 'Catfish'],
      ['', ''],
      [
        'https://en.wikipedia.org/wiki/Cat',
        'https://en.wikipedia.org/wiki/Catfish',
      ],
    ];
    expect(parseAutocompleteItems(data)).toEqual([
      { id: 'https://en.wikipedia.org/wiki/Cat', value: 'Cat' },
      { id: 'https://en.wikipedia.org/wiki/Catfish', value: 'Catfish' },
    ]);
  });

  it('falls back to the title as id when opensearch urls are missing', () => {
    expect(parseAutocompleteItems(['cat', ['Cat']])).toEqual([
      { id: 'Cat', value: 'Cat' },
    ]);
  });

  it('parses string arrays', () => {
    expect(parseAutocompleteItems(['Red', 'Blue'])).toEqual([
      { id: 'Red', value: 'Red' },
      { id: 'Blue', value: 'Blue' },
    ]);
  });

  it('parses object arrays with labelKey and valueKey', () => {
    const data = [
      { name: 'Ada', code: 1 },
      { name: 'Grace', code: 2 },
      { code: 3 }, // missing label — dropped
    ];
    expect(parseAutocompleteItems(data, 'name', 'code')).toEqual([
      { id: '1', value: 'Ada', raw: data[0] },
      { id: '2', value: 'Grace', raw: data[1] },
    ]);
  });

  it('defaults valueKey to labelKey', () => {
    const data = [{ title: 'Ada' }];
    expect(parseAutocompleteItems(data, 'title')).toEqual([
      { id: 'Ada', value: 'Ada', raw: data[0] },
    ]);
  });

  it('unwraps enveloped responses via resultsPath', () => {
    const data = { data: { items: [{ label: 'Ada' }] } };
    expect(
      parseAutocompleteItems(data, undefined, undefined, 'data.items')
    ).toEqual([{ id: 'Ada', value: 'Ada', raw: { label: 'Ada' } }]);
  });

  it('returns an empty array for a bad resultsPath', () => {
    expect(
      parseAutocompleteItems({ results: [] }, undefined, undefined, 'nope.deep')
    ).toEqual([]);
  });

  it('returns an empty array for non-array data', () => {
    expect(parseAutocompleteItems(null)).toEqual([]);
    expect(parseAutocompleteItems({ items: [] })).toEqual([]);
    expect(parseAutocompleteItems('nope')).toEqual([]);
  });
});

describe('resolveResultsPath', () => {
  it('returns data unchanged without a path', () => {
    const data = [1, 2];
    expect(resolveResultsPath(data)).toBe(data);
    expect(resolveResultsPath(data, '')).toBe(data);
  });

  it('descends dot-paths and tolerates missing segments', () => {
    expect(resolveResultsPath({ a: { b: [1] } }, 'a.b')).toEqual([1]);
    expect(resolveResultsPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(resolveResultsPath(null, 'a')).toBeUndefined();
  });
});

describe('captureAttributes', () => {
  const raw = { city: 'Toledo', state: 'OH', zip: 43604, tags: null };

  it('copies requested keys as strings', () => {
    expect(captureAttributes(raw, ['city', 'state', 'zip'])).toEqual({
      city: 'Toledo',
      state: 'OH',
      zip: '43604',
    });
  });

  it('skips missing and null keys', () => {
    expect(captureAttributes(raw, ['tags', 'nope'])).toBeUndefined();
  });

  it('returns undefined without raw data or keys', () => {
    expect(captureAttributes(undefined, ['city'])).toBeUndefined();
    expect(captureAttributes(raw, [])).toBeUndefined();
    expect(captureAttributes(raw)).toBeUndefined();
  });
});
