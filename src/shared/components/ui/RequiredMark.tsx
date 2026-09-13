/**
 * Asterisco rojo de "campo obligatorio".
 *
 * Vive acá y no como markup suelto en cada formulario por una razón concreta:
 * el wizard de onboarding usa `<input>` crudos dentro de `.onboarding-field`
 * y el resto de la app usa el primitivo `Input`. Si el asterisco se escribiera
 * a mano en cada label, las dos mitades se irían despegando (color, tamaño,
 * separación) y nadie se daría cuenta hasta la próxima captura de pantalla.
 *
 * `aria-hidden` NO es un descuido: el asterisco es el indicador VISUAL. El
 * indicador para lectores de pantalla es `required` / `aria-required` en el
 * `<input>`, que el lector anuncia como "obligatorio" en el idioma del
 * usuario. Dejarlo visible además haría que se lea "asterisco" al lado de cada
 * etiqueta, que es ruido, no información.
 *
 * El color se resuelve contra los DOS sistemas de tokens que conviven en el
 * repo (`--color-danger-text` de `styles.css`, `--err-text` de `parkit.css`),
 * con el literal como último recurso: el componente se renderiza tanto adentro
 * del onboarding como del shell del owner.
 */
export function RequiredMark() {
  return (
    <span
      aria-hidden="true"
      style={{
        color: 'var(--color-danger-text, var(--err-text, #b42318))',
        fontWeight: 700,
        marginLeft: 3,
      }}
    >
      *
    </span>
  );
}
