import { useState } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import { Button, Card, CardContent } from '@mieweb/ui';
import { FileText } from 'lucide-react';
import { Navbar } from '../components/Navbar.js';

function bytesToBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

export function RendererPdfView() {
  const [pdfSource, setPdfSource] = useState<File | null>(null);
  const [rendererKey, setRendererKey] = useState(0);
  const [renderer, setRenderer] = useState<EsheetRendererHandle | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPdfSource(file);
    setRendererKey((key) => key + 1);
    event.currentTarget.value = '';
  };

  return (
    <div className="demo-renderer-pdf-view flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <div>
              <h1 className="m-0 text-lg font-semibold text-foreground">
                Form Renderer PDF
              </h1>
              <p className="m-0 text-sm text-muted-foreground">
                Complete imported PDF forms using eSheet response state.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <input
                id="renderer-pdf-file-input"
                aria-label="Choose PDF"
                accept="application/pdf,.pdf"
                type="file"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  document.getElementById('renderer-pdf-file-input')?.click()
                }
              >
                <FileText size={14} />
                <span className="ml-1">Open PDF</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!renderer}
                onClick={() => {
                  void renderer?.exportPdf().then((bytes) => {
                    const url = URL.createObjectURL(bytesToBlob(bytes));
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = 'completed-esheet-form.pdf';
                    anchor.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 0);
                  });
                }}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          {pdfSource ? (
            <EsheetRenderer
              key={rendererKey}
              representation="pdf"
              pdfSource={pdfSource}
              fitToContainer
              onReady={() => setRenderer(null)}
              ref={setRenderer}
            />
          ) : (
            <div className="flex min-h-full items-center justify-center p-6">
              <Card className="w-full max-w-md">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <FileText
                    aria-hidden="true"
                    className="text-muted-foreground"
                    size={42}
                    strokeWidth={1.5}
                  />
                  <div>
                    <h2 className="m-0 text-xl font-semibold text-foreground">
                      Open a PDF form
                    </h2>
                    <p className="mb-0 mt-2 text-sm text-muted-foreground">
                      Select a PDF to render its pages and complete supported
                      AcroForm fields.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() =>
                      document
                        .getElementById('renderer-pdf-file-input')
                        ?.click()
                    }
                  >
                    <FileText size={16} />
                    <span className="ml-1">Open PDF</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
