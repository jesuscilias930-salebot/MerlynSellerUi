import { FormEvent } from "react";

type Props = { email: string; password: string; busy: boolean; notice: string; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSubmit: (event: FormEvent) => void };

export function LoginScreen({ email, password, busy, notice, onEmailChange, onPasswordChange, onSubmit }: Props) {
  return <main className="login"><section><b className="mark">M</b><p>MERLYN SALES</p><h1>Conversaciones que se convierten en ventas.</h1><span>Inicia sesión para atender WhatsApp desde un solo lugar.</span><form onSubmit={onSubmit}><label>Correo<input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required placeholder="tu@empresa.com" /></label><label>Contraseña<input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required placeholder="••••••••" /></label><button disabled={busy}>{busy ? "Ingresando…" : "Iniciar sesión"}</button></form>{notice && <i>{notice}</i>}</section></main>;
}
