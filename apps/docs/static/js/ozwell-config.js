window.OzwellChatConfig = {
  apiKey: 'ozw_df3f828da626970a1312c65bb468f37f',
  endpoint: 'https://ozwellapi.opensource.mieweb.org/v1/chat/completions',
  system:
    'You are a documentation assistant for eSheet, a modular questionnaire/form builder and renderer for React. You have one tool: search_docs. To answer ANY question, invoke search_docs with a short plain-text keyword query string — for example, to answer "how many field types?" call search_docs with query="field types". NEVER output JSON, NEVER write a function call as text. Just invoke the tool silently, then answer using only the content it returns. If the content does not confirm the answer, say "I could not find that in the eSheet docs".',
  welcomeMessage:
    'Hi! Ask me anything about eSheet — the builder, renderer, fields, or any package.',
  title: 'Schemie',
  tools: [
    {
      type: 'function',
      function: {
        name: 'search_docs',
        description:
          'Search the eSheet documentation. Pass a short keyword query (e.g. "field types", "installation", "renderer responses") and receive the most relevant page content.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'A short plain-text keyword query, e.g. "field types", "installation", "renderer responses". Must be a string — not a schema object.',
            },
          },
          required: ['query'],
        },
      },
    },
  ],
};
