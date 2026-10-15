import { useRef, useState } from 'react'
import { FileCheck2, FileUp, ShieldCheck } from 'lucide-react'

interface FileUploadProps {
  fileName?: string
  loading: boolean
  error?: string
  onFile: (file: File) => void
}

export function FileUpload({ fileName, loading, error, onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const receiveFile = (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) return
    onFile(file)
  }

  return (
    <section className="upload-card">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${fileName ? 'loaded' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          if (event.currentTarget === event.target) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          receiveFile(event.dataTransfer.files[0])
        }}
      >
        <div className="upload-icon">{fileName ? <FileCheck2 /> : <FileUp />}</div>
        <div className="upload-copy">
          <h2>{fileName ? 'Fatura carregada' : 'Importe sua fatura'}</h2>
          <p>{fileName ?? 'Arraste o CSV do Nubank ou selecione o arquivo no computador.'}</p>
        </div>
        <button className="button-primary" type="button" disabled={loading} onClick={() => inputRef.current?.click()}>
          {loading ? 'Lendo arquivo...' : fileName ? 'Trocar arquivo' : 'Selecionar CSV'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => receiveFile(event.target.files?.[0])}
        />
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="privacy-note"><ShieldCheck size={16} /> O arquivo é processado somente neste navegador e não é enviado a servidores.</div>
    </section>
  )
}
