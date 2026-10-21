import { useEffect, useState } from 'react';
import { api, downloadFile, errorMessage } from '../api.js';

// Loads a protected document file as a blob and shows images and PDFs inline.
export default function FilePreview({ documentId, version, file, height = 420 }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const previewable = file && (file.mimeType?.startsWith('image/') || file.mimeType === 'application/pdf');

  useEffect(() => {
    if (!previewable) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setError('');
    api
      .get(`/documents/${documentId}/file`, { params: { version }, responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, version, file?.filename, previewable]);

  if (!file) return <div className="file-empty">No file attached</div>;

  const download = () => downloadFile(`/documents/${documentId}/file`, file.originalName, { version });

  return (
    <div className="file-preview">
      <div className="file-meta">
        <span title={file.originalName}>{file.originalName}</span>
        <span className="muted small">{(file.size / 1024).toFixed(0)} KB</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={download}>Download</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {previewable && !url && !error && <div className="file-empty">Loading preview…</div>}
      {url && file.mimeType.startsWith('image/') && <img src={url} alt={file.originalName} style={{ maxHeight: height }} />}
      {url && file.mimeType === 'application/pdf' && <iframe src={url} title={file.originalName} style={{ height }} />}
      {!previewable && <div className="file-empty">Preview not available for this file type. Use Download.</div>}
    </div>
  );
}
