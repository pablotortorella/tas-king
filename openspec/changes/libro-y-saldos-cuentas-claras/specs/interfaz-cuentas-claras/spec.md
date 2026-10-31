## ADDED Requirements

### Requirement: El caso frecuente se resuelve con pocos pasos

Agregar movimiento SHALL ofrecer gasto, ingreso y transferencia. Para un gasto el
formulario SHALL partir con la fecha de hoy, la moneda del libro, un pagador (la
persona autenticada), todos los participantes como beneficiarios y reparto igual,
mostrando cada supuesto y permitiendo modificarlo. Antes de confirmar SHALL
mostrarse el efecto previsto sobre los saldos.

#### Scenario: Gasto compartido simple

- **WHEN** una persona abre «Agregar movimiento» en un libro de cuatro
- **THEN** completa descripción e importe y confirma sin tocar otros campos, y ve
  el efecto previsto de cada participante antes de guardar

#### Scenario: Cambiar el tipo conserva lo ya escrito

- **WHEN** la persona cambia de gasto a transferencia tras escribir una
  descripción
- **THEN** la descripción se conserva

### Requirement: Importes y signos nunca dependen sólo del color

Cada importe con efecto SHALL mostrar signo y una palabra («te deben», «debe»,
«anulado») además de cualquier color. Los controles táctiles SHALL medir al menos
44 px, los campos SHALL tener etiqueta, y el flujo completo SHALL poder usarse con
teclado.

#### Scenario: Usuario con daltonismo

- **WHEN** una persona no distingue verde de rojo
- **THEN** sigue distinguiendo saldos a favor y en contra por el signo y la palabra

### Requirement: La interfaz respeta el esquema de color del dispositivo

La interfaz SHALL definir sus colores como variables y SHALL ofrecer una paleta
clara y una oscura seleccionadas por `prefers-color-scheme`. Cada par de texto y
fondo SHALL cumplir contraste mínimo 4,5:1 (3:1 para bordes de controles). La
paleta concreta es provisional hasta que la suite defina sus temas.

#### Scenario: Dispositivo en modo oscuro

- **WHEN** el sistema del dispositivo está en modo oscuro
- **THEN** todas las pantallas de Cuentas Claras usan la paleta oscura sin texto
  ilegible ni fondos claros residuales

### Requirement: Escritorio y móvil muestran la misma información

En pantallas anchas el libro SHALL mostrar saldos, sugerencias y movimientos
juntos; en estrechas SHALL apilarlos sin perder ninguna acción.

#### Scenario: Reducir el ancho

- **WHEN** la ventana pasa de escritorio a ancho de teléfono
- **THEN** los paneles se apilan y todas las acciones siguen disponibles
