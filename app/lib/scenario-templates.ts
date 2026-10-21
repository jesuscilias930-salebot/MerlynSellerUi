import type { ScenarioStep } from "./types";

export type ScenarioTemplate = {
  id: string;
  icon: string;
  title: string;
  description: string;
  name: string;
  triggers: string[];
  aiDescription: string;
  /** Pasos con ids locales; `instantiate` los vuelve únicos. */
  steps: ScenarioStep[];
};

const step = (id: string, type: ScenarioStep["type"], label: string, extra: Partial<ScenarioStep> = {}): ScenarioStep => ({ id, type, label, ...extra });

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "blank", icon: "＋", title: "En blanco", description: "Un mensaje y el final. Arma tu flujo desde cero.",
    name: "", triggers: [], aiDescription: "",
    steps: [step("mensaje", "send_text", "Enviar mensaje", { body: "", nextStepId: "fin" }), step("fin", "end", "Finalizar")],
  },
  {
    id: "welcome", icon: "👋", title: "Bienvenida y catálogo", description: "Saluda, envía el catálogo y ofrece ayuda para elegir.",
    name: "Bienvenida y catálogo", triggers: ["hola", "información", "quiero el catálogo", "me pasas el catálogo"],
    aiDescription: "El cliente saluda o pide información general o el catálogo de productos.",
    steps: [
      step("saludo", "send_text", "Saludo", { body: "¡Hola! 👋 Gracias por escribir a Merlyn Mayoreo. Te comparto nuestro catálogo.", nextStepId: "catalogo" }),
      step("catalogo", "send_catalog", "Enviar catálogo", { caption: "Catálogo de mayoreo", nextStepId: "ayuda" }),
      step("ayuda", "send_text", "Ofrecer ayuda", { body: "Cuando lo revises dime qué paquete te interesa y te ayudo con tu pedido 😊", nextStepId: "fin" }),
      step("fin", "end", "Finalizar"),
    ],
  },
  {
    id: "packages", icon: "☰", title: "Elegir paquete con opciones", description: "Lista de paquetes con precio; cada opción sigue su camino.",
    name: "Elegir paquete", triggers: ["quiero paquetes", "precios de paquetes", "qué paquetes tienen", "precio de mayoreo"],
    aiDescription: "El cliente pregunta por paquetes o precios de mayoreo y quiere elegir uno.",
    steps: [
      step("opciones", "send_options", "Elegir paquete", {
        header: "Paquetes de mayoreo", body: "¿Qué paquete te interesa? Toca «Ver paquetes» y elige una opción.", footer: "Precios sin envío",
        format: "auto", buttonText: "Ver paquetes", sectionTitle: "Paquetes",
        fallbackBody: "Toca «Ver paquetes» y elige una opción para ayudarte más rápido 😊",
        options: [
          { title: "Caricatura 50 pares", description: "$446.50", nextStepId: "confirmar" },
          { title: "Caricatura 100 pares", description: "$882", nextStepId: "confirmar" },
          { title: "Caricatura 200 pares", description: "$1,728", nextStepId: "confirmar" },
          { title: "Caricatura 500 pares", description: "$4,120", nextStepId: "confirmar" },
          { title: "Deportivo Pro 450 pares", description: "$3,999", nextStepId: "confirmar" },
          { title: "Ayúdame a elegir", nextStepId: "asesoria" },
        ],
      }),
      step("confirmar", "send_text", "Pedir código postal", { body: "¡Excelente elección! 🙌 ¿Me compartes tu código postal para cotizar el envío?", nextStepId: "fin" }),
      step("asesoria", "send_text", "Ayudar a elegir", { body: "Con gusto te ayudo 😊 ¿Para vender o para uso personal, y cuántos pares buscas más o menos?", nextStepId: "fin" }),
      step("fin", "end", "Finalizar"),
    ],
  },
  {
    id: "shipping", icon: "📦", title: "Preguntas de envío", description: "Responde si hacen envíos y pide el código postal.",
    name: "Envíos nacionales", triggers: ["hacen envíos", "envían a", "cuánto cuesta el envío", "mandan a mi ciudad"],
    aiDescription: "El cliente pregunta si hacen envíos, a dónde o cuánto cuesta el envío.",
    steps: [
      step("respuesta", "send_text", "Responder envíos", { body: "¡Sí! Enviamos a todo México desde Orizaba, Veracruz 📦. ¿Me compartes tu código postal para cotizar?", nextStepId: "fin" }),
      step("fin", "end", "Finalizar"),
    ],
  },
  {
    id: "budget", icon: "💰", title: "Recomendar por presupuesto", description: "Pregunta el presupuesto y recomienda un paquete con fotos.",
    name: "Recomendación por presupuesto", triggers: ["qué me recomiendas", "cuál me conviene", "tengo un presupuesto de"],
    aiDescription: "El cliente pide una recomendación o menciona cuánto quiere invertir.",
    steps: [
      step("pregunta", "send_text", "Preguntar presupuesto", { body: "¡Claro! ¿Cuánto te gustaría invertir aproximadamente?", nextStepId: "recomendar" }),
      step("recomendar", "budget_recommendation", "Recomendar paquete", { fallbackBody: "¿Me indicas un monto aproximado para recomendarte el mejor paquete?", nextStepId: "fin" }),
      step("fin", "end", "Finalizar"),
    ],
  },
];

/** Copia los pasos con ids únicos y conexiones actualizadas. */
export function instantiateSteps(template: ScenarioTemplate, unique: () => string): ScenarioStep[] {
  const ids = new Map(template.steps.map(item => [item.id, unique()]));
  const map = (id?: string) => (id ? ids.get(id) : undefined);
  return template.steps.map(item => ({
    ...item,
    id: ids.get(item.id) as string,
    nextStepId: map(item.nextStepId),
    fallbackStepId: map(item.fallbackStepId),
    options: item.options?.map(option => ({ ...option, nextStepId: map(option.nextStepId) })),
    branches: item.branches?.map(branch => ({ ...branch, nextStepId: map(branch.nextStepId) as string })),
  }));
}
