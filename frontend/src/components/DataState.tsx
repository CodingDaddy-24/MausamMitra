import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading data' }: { label?: string }) { return <div className="data-state"><LoaderCircle className="spin" size={20} /><span>{label}</span></div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="data-state error-state"><AlertCircle size={20} /><span>{message}</span>{retry ? <button className="button-quiet" onClick={retry}>Retry</button> : null}</div> }
export function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><div className="empty-mark">—</div><strong>{title}</strong><p>{detail}</p></div> }
