# Tic Tac Happy Ball

**PROMPT ESTRUCTURAL AJUSTADO - TIC TAC (SIMPLE PERO PROFESIONAL)**

***

**CONTEXTO CRÍTICO**
Construye una app para escuela de fútbol "TIC TAC - Siempre Feliz". 
**Usuarios:** Administradora y padres con CERO experiencia tecnológica.
**Requisito:** Interfaz extremadamente simple pero visualmente elegante y profesional.
**Demo:** Lunes.

**PALETA DE COLORES (Del logo)**
- **Cyan:** `#00E5FF` (botones de acción principal)
- **Dorado:** `#FFC107` (alertas, notificaciones)
- **Negro:** `#0A0A0A` (fondos)
- **Gris oscuro:** `#1A1A1A` (tarjetas)
- **Blanco:** `#FFFFFF` (texto)
- **Verde:** `#00E676` (éxito/confirmado)
- **Rojo:** `#FF5252` (alerta/rechazado)

**LOGO**
Logo circular con balón en header de todas las pantallas.

---

## 🎯 PRINCIPIOS DE DISEÑO (NO NEGOCIABLES)

1. **Máximo 3 acciones por pantalla** - Sin saturar
2. **Botones gigantes** - Mínimo 60px alto, texto grande
3. **Sin menús desplegables** - Todo visible
4. **Iconos + Texto** - Nunca solo iconos
5. **Una tarea por pantalla** - Flujos lineales
6. **Feedback inmediato** - Colores y mensajes claros
7. **Sin tablas complejas** - Usar tarjetas visuales
8. **Lenguaje cotidiano** - Nada de términos técnicos

---

## 📱 ESTRUCTURA DE NAVEGACIÓN

### **ADMINISTRADORA** (4 pantallas máximo)

**Pantalla 1: INICIO (Dashboard)**
```
┌─────────────────────────────────────┐
│  [LOGO]                             │
│  Buenos días, [Nombre]              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   PAGOS PENDIENTES                │
│  5 alumnos                          │
│  [Ver y Aprobar] ← Botón grande     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📅 ASISTENCIA HOY                  │
│  12 de 20 confirmados               │
│  [Ver Lista] ← Botón grande         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ⚠️ ALERTAS                         │
│  2 pagos atrasados (2+ meses)       │
└─────────────────────────────────────┘

[Inicio] [Alumnos] [Avisos] [Más] ← Barra inferior
```

**Pantalla 2: ALUMNOS**
```
┌─────────────────────────────────────┐
│  🔍 Buscar alumno...                │
│  (nombre o RUT)                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👤 Alejandro Pizarro               │
│  SUB12 - Miércoles 15:00            │
│  [Ver Ficha]                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👤 Gestiotech SPA                  │
│  SUB12 - Miércoles 15:00            │
│  [Ver Ficha]                        │
─────────────────────────────────────┘

[+ Agregar Alumno] ← Botón flotante cyan
```

**Pantalla 3: PAGOS (La más importante)**
```
┌─────────────────────────────────────┐
│  FILTROS:                           │
│  [Todos] [Pendientes] [Aprobados]   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🟡 PENDIENTE                       │
│  Alejandro Pizarro - $50.000        │
│  Mensualidad Enero                  │
│  [Ver Foto] [Aprobar] [Rechazar]    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🟢 APROBADO                        │
│  María González - $50.000           │
│  Mensualidad Enero                  │
│  [Ver detalles]                     │
└─────────────────────────────────────┘
```

**Pantalla 4: AVISOS**
```
─────────────────────────────────────┐
│  📢 ENVIAR AVISO                    │
│                                     │
│  Título:                            │
│  [________________]                 │
│                                     │
│  Mensaje:                           │
│  [________________]                 │
│  [________________]                 │
│                                     │
│  Para:                              │
│  ⚪ Todos                           │
│   SUB12                           │
│  ⚪ SUB15                           │
│                                     │
│  [ENVIAR AVISO] ← Botón cyan grande │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  AVISOS ENVIADOS                    │
│  Torneo sábado 9:00 - Enviado hoy   │
│  Reunión apoderados - Enviado ayer  │
└─────────────────────────────────────┘
```

---

### **PADRES/APODERADOS** (3 pantallas máximo)

**Pantalla 1: INICIO (Lo único que usan 90% del tiempo)**
```
┌─────────────────────────────────────┐
│  [LOGO]                             │
│  Escuela TIC TAC                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ⚽ PRÓXIMO ENTRENAMIENTO           │
│  Miércoles 3:00 PM - SUB12          │
│                                     │
│  ¿Viene Alejandro?                  │
│                                     │
│  [✅ SÍ VOY]  [❌ NO VOY]           │
│  ← Botones GIGANTES (alto 80px)     │
─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  💳 PAGOS                           │
│  🟢 Todo al día                     │
│  Próximo: $50.000 (15 de Enero)     │
│  [Subir Comprobante]                │
─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📢 AVISOS                          │
│  ⚽ Torneo este sábado 9:00 AM      │
│  📋 Reunión viernes 19:00           │
─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🥗 NUTRICIONISTA                   │
│  Evaluación Semestre 1              │
│  [Agendar Hora]                     │
└─────────────────────────────────────┘

[Inicio] [Mi Hijo] [Info] ← Barra inferior
```

**Pantalla 2: MI HIJO**
```
┌─────────────────────────────────────┐
│  👤 Alejandro Pizarro               │
│  SUB12 - Miércoles 15:00            │
│  Profesor: Carlos Martínez          │
─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📞 CONTACTO DE EMERGENCIA          │
│  María Pizarro (Madre)              │
│  +56 9 1234 5678                    │
│  [Editar]                           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📅 ASISTENCIA                      │
│  Últimos 5 entrenamientos:          │
│  ✅ 15 Ene  ❌ 8 Ene  ✅ 1 Ene      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  💳 HISTORIAL DE PAGOS              │
│  Enero 2024 - ✅ Pagado             │
│  Diciembre 2023 - ✅ Pagado         │
─────────────────────────────────────┘
```

**Pantalla 3: INFORMACIÓN**
```
┌─────────────────────────────────────┐
│  📋 REGLAMENTO                      │
│  [Ver documento]                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   OBJETIVO DE LA ESCUELA          │
│  Formar jugadores con valores...    │
│  [Leer más]                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👨‍ PROFESORES                     │
│  Carlos Martínez - SUB12            │
│  [Ver perfil]                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   FOTOS                           │
│  [Ver galería]                      │
─────────────────────────────────────┘
```

---

## 🗄️ BASE DE DATOS (Supabase - Simplificada)

```sql
-- Solo lo esencial
profiles (
  id, 
  email, 
  password, 
  role, -- 'admin' o 'parent'
  full_name, 
  phone
)

players (
  id, 
  parent_id, 
  name, 
  category, -- SUB12, SUB15
  rut,
  emergency_contact_name,
  emergency_contact_phone
)

payments (
  id, 
  player_id, 
  amount, 
  due_date, 
  status, -- 'pending', 'approved', 'rejected'
  receipt_url,
  concept -- 'matricula', 'mensualidad'
)

attendance (
  id, 
  player_id, 
  session_date, 
  status -- 'confirmed', 'absent', 'no_response'
)

notices (
  id, 
  title, 
  content, 
  target_category, -- 'all', 'SUB12', 'SUB15'
  created_at
)

nutrition_sessions (
  id,
  player_id,
  semester, -- 1 o 2
  year,
  status, -- 'pending', 'booked', 'completed'
  scheduled_date
)
```

---

##  FUNCIONALIDADES ESENCIALES

**Admin:**
1. ✅ Login simple (email + contraseña)
2. ✅ Ver pagos pendientes con foto del comprobante
3. ✅ Botón "Aprobar" / "Rechazar" (un clic)
4. ✅ Ver lista de alumnos con buscador
5. ✅ Marcar asistencia manualmente
6. ✅ Enviar aviso (título + mensaje + categoría)

**Padres:**
1. ✅ Login simple
2. ✅ Confirmar asistencia (1 botón)
3. ✅ Subir foto de comprobante (abre cámara)
4. ✅ Ver estado de pagos
5. ✅ Ver/editar contacto de emergencia
6. ✅ Agendar hora nutricionista (abre WhatsApp)

---

##  INSTRUCCIONES DE UI/UX

**Visual:**
- Fondo negro `#0A0A0A`
- Tarjetas gris oscuro `#1A1A1A` con borde cyan sutil `#00E5FF` (2px)
- Espaciado generoso (padding 24px mínimo)
- Tipografía: Sans-serif moderna (Inter o similar)
- Tamaño texto: 18px mínimo, 24px títulos
- Sombras sutiles en tarjetas

**Componentes:**
- **Botón Primario:** Cyan `#00E5FF`, texto negro, alto 60px, esquinas redondeadas 12px
- **Botón Secundario:** Borde cyan, fondo transparente
- **Botón Alerta:** Dorado `#FFC107`, texto negro
- **Card:** Fondo `#1A1A1A`, padding 20px, margen 16px
- **Badge Estado:** Verde (aprobado), Rojo (rechazado), Amarillo (pendiente)

**Navegación:**
- Barra inferior fija con 3-4 iconos + texto
- Iconos grandes (24px)
- Sin menús hamburguesa
- Sin submenús
- Siempre visible dónde estás

**Interacciones:**
- Feedback táctil inmediato (cambio de color al tocar)
- Loading visible (spinner cyan)
- Mensajes de éxito/error claros (banner verde/rojo arriba)
- Confirmación antes de acciones destructivas

---

## 📱 DATOS DE DEMO (Seed)

```javascript
// Admin
{ email: 'admin@tictac.cl', password: 'demo123', role: 'admin', name: 'María González' }

// Padres
{ email: 'padre1@demo.cl', password: '123456', role: 'parent', name: 'Carlos Pizarro' }
{ email: 'padre2@demo.cl', password: '123456', role: 'parent', name: 'Ana Martínez' }

// Alumnos
{ name: 'Alejandro Pizarro', category: 'SUB12', parent: 'padre1@demo.cl' }
{ name: 'Sofia Martínez', category: 'SUB12', parent: 'padre2@demo.cl' }

// Pagos de ejemplo
{ player: 'Alejandro', amount: 50000, status: 'pending', concept: 'Mensualidad Enero' }
{ player: 'Sofia', amount: 50000, status: 'approved', concept: 'Mensualidad Enero' }

// Avisos
{ title: 'Torneo Sábado', content: 'Cita 9:00 AM - Cancha 1', category: 'SUB12' }
```

---

## ⚡ INSTRUCCIONES FINALES PARA LOVABLE

"Construye esta app priorizando:
1. **Similitud visual** con el logo (cyan, negro, dorado)
2. **Simplicidad extrema** - Máximo 3 acciones por pantalla
3. **Botones grandes** - Fáciles de tocar en celular
4. **Sin jerga técnica** - Lenguaje cotidiano
5. **Flujos lineales** - Paso 1 → Paso 2 → Listo
6. **Feedback visual** - Colores que guíen
7. **Mobile-first** - Se ve perfecto en celular
8. **Elegante** - Espacios en blanco, tipografía limpia

**NO usar:**
- Tablas complejas
- Menús desplegables
- Iconos sin texto
- Términos técnicos (CRUD, dashboard, etc.)
- Colores que no sean de la paleta

**SÍ usar:**
- Tarjetas grandes
- Botones evidentes
- Iconos reconocibles (💰 📅 👤 ✅)
- Textos descriptivos
- Espaciado generoso

**Testing:** Imagina que una persona de 60 años sin experiencia con smartphones debe usar esto. Si puede hacerlo sin ayuda, está bien."

***

**Próximo paso:** Copia este prompt en Lovable. El resultado será una app que se ve profesional y tecnológica, pero que cualquier persona puede usar sin instrucciones.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/865b0de8-b8ae-491a-96da-e19d8383e038).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
