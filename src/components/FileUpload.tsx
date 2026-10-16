import { useRef, useState } from 'react'
import { FileCheck2, FileUp, ShieldCheck } from 'lucide-react'
import { ACCEPTED_EXTENSIONS } from '../services/importService'

interface FileUploadProps {
  fileName?: string
  loading: boolean
  error?: string
  onFile: (file: File) => void
}

/**
 * iPhone/iPad e Android não reconhecem o tipo .ofx no seletor de arquivos:
 * com o filtro "accept", o arquivo aparece acinzentado e não pode ser escolhido.
 * Nesses aparelhos o filtro é removido; o formato é validado no importService.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(userAgent)

  return isIOS || isAndroid
}

const DESKTOP_ACCEPT = [...ACCEPTED_EXTENSIONS, 'application/x-ofx', 'text/csv'].join(',')

export function FileUpload({ fileName, loading, error, onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const mobile = isMobileDevice()

  const receiveFile = (file?: File) => {
    if (file) onFile(file)
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
          <p>
            {fileName ||
              (mobile
                ? 'Selecione o OFX do seu banco ou o CSV do Nubank.'
                : 'Arraste o OFX do seu banco ou o CSV do Nubank.')}
          </p>
        </div>
        <button
          className="button-primary"
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? 'Lendo arquivo...' : fileName ? 'Importar outra fatura' : 'Selecionar arquivo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          {...(mobile ? {} : { accept: DESKTOP_ACCEPT })}
          hidden
          onChange={(event) => {
            receiveFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="privacy-note">
        <ShieldCheck size={16} /> Formatos aceitos: OFX (qualquer banco) e CSV do Nubank. O arquivo
        é lido no navegador; somente os lançamentos são sincronizados com a sua conta.
      </div>
    </section>
  )
}