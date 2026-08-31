import { z } from "zod";

export const matriculaSchema = z
  .object({
    nombre_apoderado: z.string().trim().min(1, "Nombre del apoderado obligatorio").max(120),
    rut_apoderado: z.string().trim().min(6, "RUT del apoderado inválido").max(20),
    email: z.string().trim().email("Correo del apoderado inválido").max(255),
    telefono: z.string().trim().min(6, "Teléfono del apoderado inválido").max(40),
    nombre_alumno: z.string().trim().min(1, "Nombre del alumno obligatorio").max(120),
    rut_alumno: z.string().trim().min(6, "RUT del alumno inválido").max(20),
    fecha_nacimiento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida"),
    talla_polera: z.string().trim().max(20).default(""),
    condiciones_medicas: z.string().trim().max(1000).default(""),
    training_tuesday: z.boolean().default(true),
    training_thursday: z.boolean().default(false),
  })
  .refine((data) => data.training_tuesday || data.training_thursday, {
    message: "Elige al menos un día de entrenamiento",
    path: ["training_tuesday"],
  });

export type EntradaMatricula = z.input<typeof matriculaSchema>;

export type ResultadoMatricula = {
  email: string;
  clave: string;
  nuevoUsuario: boolean;
  hermanos: string[];
};

