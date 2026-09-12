import { useRouteError } from 'react-router-dom';
import { translateApiError } from '../../lib/api/translate';
import { Button } from './ui/Button';
import { Logo } from './Logo';

/**
 * Red de contención de los loaders del router.
 *
 * Sin un `errorElement`, cualquier excepción que escape de un loader la pinta
 * React Router con su pantalla de desarrollo: el stack trace crudo y el cartel
 * "💿 Hey developer 👋". Al dueño de un estacionamiento eso no le dice nada, y
 * peor: parece que la app se rompió para siempre cuando en general es el
 * backend que se cayó un rato o el wifi que se fue.
 *
 * La sesión muerta NO llega hasta acá — la resuelve `fetchMe` redirigiendo al
 * login. Lo que cae acá es lo transitorio: 500, 502, timeouts, red caída. Por
 * eso la acción principal es reintentar y no desloguear.
 *
 * `window.location.reload()` y no un `revalidate()` del router a propósito: si
 * el loader se cayó, el estado del árbol quedó a medio construir, y volver a
 * levantar todo desde cero es más honesto que reintentar una pata sola.
 */
export function RouteErrorPage() {
  const error = useRouteError();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '48px 24px',
        textAlign: 'center',
        background: 'var(--bg-b)',
      }}
    >
      <Logo />
      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-1)',
        }}
      >
        No pudimos cargar esta pantalla
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--text-2)',
          maxWidth: 380,
        }}
      >
        {translateApiError(error)}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = '/login';
          }}
        >
          Ir al inicio de sesión
        </Button>
      </div>
    </main>
  );
}
