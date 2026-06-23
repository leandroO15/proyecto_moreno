# Portal de Consultas Estudiantiles
## Dirección de Bienestar · Universidad Nacional de Moreno

Sitio web estático para consultas estudiantiles sobre Becas, Boleto Estudiantil y Estacionamiento.

---

## Estructura de archivos

```
/index.html            → Página principal con cards de acceso
/becas.html            → Flujo wizard de Becas (4 preguntas)
/boleto.html           → Flujo wizard de Boleto Estudiantil (4 preguntas)
/estacionamiento.html  → Flujo de Estacionamiento (selección de vehículo)
/admin.html            → Panel de seguimiento de consultas
/css/styles.css        → Estilos completos
/js/app.js             → Lógica compartida (wizard + formulario + localStorage)
/js/admin.js           → Lógica del panel de administración
/logo.png              → Logo de la UNM (colocar aquí)
```

---

## Uso

### Abrir en el navegador
Podés abrir `index.html` directamente desde el sistema de archivos (doble clic) o servir los archivos con cualquier servidor web estático.

Con Python (si está instalado):
```bash
python -m http.server 8000
```
Luego acceder a `http://localhost:8000`.

### Agregar el logo
Colocá el archivo `logo.png` en la raíz del proyecto (junto a `index.html`).

---

## Panel de administración

URL: `/admin.html`

**Contraseña:** `bienestar2024`

Funcionalidades:
- Ver todas las consultas recibidas (guardadas en localStorage del navegador)
- Filtrar por área y estado
- Editar el estado de cada consulta (Pendiente / En proceso / Resuelto)
- Exportar todas las consultas a CSV
- Limpiar consultas resueltas
- Eliminar consultas individuales

> **Nota:** Las consultas se almacenan en el `localStorage` del navegador. Son persistentes en el mismo navegador/dispositivo pero no se sincronizan entre dispositivos.

---

## Envío de consultas

El formulario de contacto guarda las consultas en `localStorage` y ofrece un enlace `mailto:` prellenado que abre el cliente de correo del usuario con los datos completos, apuntando a:

**proyecto.bienestar.moreno@gmail.com**

---

## Paleta de colores

| Color        | Hex       |
|--------------|-----------|
| Azul oscuro  | `#1a3a5c` |
| Azul medio   | `#3a6bc8` |
| Blanco       | `#ffffff` |
| Negro suave  | `#1a1a1a` |
| Gris claro   | `#f4f6f9` |
