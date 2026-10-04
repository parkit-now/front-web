import { Outlet } from 'react-router-dom';

/**
 * Contenedor de las pantallas de configuración. La navegación entre ellas
 * (Perfil, Horarios, Servicios, Retención) vive en el grupo desplegable
 * "Configuración" del sidebar; cada una es una ruta hija de `config/`.
 */
export function ConfigPage() {
  return (
    <div style={{ minWidth: 0 }}>
      <Outlet />
    </div>
  );
}
