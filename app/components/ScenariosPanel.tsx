"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../lib/api";
import ScenarioCodexConnection from "./ScenarioCodexConnection";
import { ConfirmDialog } from "./ConfirmDialog";
import { StepTypePicker } from "./StepTypePicker";
import { NewScenarioStart, type NewScenarioChoice } from "./NewScenarioStart";
import { buildFlowGraph, edgeLabel, insertStepAfter, NODE_HEIGHT, NODE_WIDTH, START_WIDTH } from "../lib/scenario-graph";
import { instantiateSteps } from "../lib/scenario-templates";
import { ScenarioOptionsStep, stepOptionsIssue } from "./ScenarioOptionsStep";
import type {
  AutomationScenario,
  EntrepreneurPackage,
  LeadColumn,
  ScenarioBranch,
  ScenarioBudgetOption,
  ScenarioMedia,
  ScenarioStep,
} from "../lib/types";

type Draft = Omit<AutomationScenario, "id" | "key" | "updatedAt" | "position">;
type Props = {
  scenarios: AutomationScenario[];
  columns: LeadColumn[];
  entrepreneurPackages: EntrepreneurPackage[];
  onSave: (value: Draft, id?: string) => Promise<AutomationScenario | void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (scenarioIds: string[]) => Promise<void>;
};
type ReusableScenarioMedia = ScenarioMedia & { source: string };

const stepId = () =>
  `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const labels: Record<ScenarioStep["type"], string> = {
  send_text: "Enviar mensaje",
  send_catalog: "Enviar catálogo",
  send_media: "Enviar imágenes o documentos",
  wait_reply: "Esperar respuesta",
  send_options: "Mensaje con opciones",
  budget_recommendation: "Recomendar por presupuesto",
  move_column: "Mover lead",
  end: "Finalizar",
};
const icons: Record<ScenarioStep["type"], string> = {
  send_text: "✉",
  send_catalog: "▤",
  send_media: "▧",
  wait_reply: "◌",
  send_options: "☰",
  budget_recommendation: "💰",
  move_column: "↗",
  end: "✓",
};
const defaultBudgetOptions = (): ScenarioBudgetOption[] => [
  {
    id: `budget_low_${stepId()}`,
    label: "Menos de $1,500",
    min: 0,
    max: 1499,
    examples: ["menos de 1500", "mil", "1000", "1200"],
    packageIds: [],
    items: [],
    recommendationBody: "",
  },
  {
    id: `budget_mid_${stepId()}`,
    label: "De $1,500 a $3,000",
    min: 1500,
    max: 3000,
    examples: ["1500", "2000", "2500", "3000"],
    packageIds: [],
    items: [],
    recommendationBody: "",
  },
  {
    id: `budget_high_${stepId()}`,
    label: "Más de $3,000",
    min: 3001,
    examples: ["mas de 3000", "más de 3000", "4000", "5000"],
    packageIds: [],
    items: [],
    recommendationBody: "",
  },
];
const optionDefaults = (): Partial<ScenarioStep> => ({
  body: "",
  format: "auto",
  buttonText: "Ver opciones",
  options: [{ title: "" }, { title: "" }],
});
const blankStep = (type: ScenarioStep["type"] = "send_text"): ScenarioStep => ({
  id: stepId(),
  type,
  label: labels[type],
  ...(type === "send_text" ? { body: "" } : {}),
  ...(type === "wait_reply" ? { branches: [] } : {}),
  ...(type === "send_options" ? optionDefaults() : {}),
  ...(type === "budget_recommendation"
    ? { budgetOptions: defaultBudgetOptions() }
    : {}),
});
const emptyScenario = (): Draft => {
  const message = blankStep("send_text");
  const end = blankStep("end");
  message.nextStepId = end.id;
  return {
    name: "",
    isActive: true,
    triggerExamples: [],
    aiDescription: "",
    priority: 0,
    canInterrupt: true,
    steps: [message, end],
  };
};
const truncate = (value?: string, limit = 78) =>
  !value
    ? "Sin contenido configurado"
    : value.length > limit
      ? `${value.slice(0, limit)}…`
      : value;

function FlowBuilder({
  initial,
  initialDraft,
  columns,
  entrepreneurPackages,
  reusableMedia,
  onSave,
  onDelete,
  onCancel,
}: {
  initial?: AutomationScenario;
  initialDraft?: Draft;
  columns: LeadColumn[];
  entrepreneurPackages: EntrepreneurPackage[];
  reusableMedia: ReusableScenarioMedia[];
  onSave: Props["onSave"];
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState<Draft>(
    initial
      ? {
          name: initial.name,
          isActive: initial.isActive,
          triggerExamples: initial.triggerExamples,
          aiDescription: initial.aiDescription || "",
          priority: initial.priority || 0,
          canInterrupt: initial.canInterrupt !== false,
          steps: initial.steps,
        }
      : initialDraft || emptyScenario(),
  );
  const [triggerText, setTriggerText] = useState(
    (initial?.triggerExamples || initialDraft?.triggerExamples || []).join("\n"),
  );
  const [selectedStepId, setSelectedStepId] = useState(
    value.steps[0]?.id || "",
  );
  // Menú de tipos de paso abierto: "toolbar" o el id de la tarjeta.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(!initial && !initialDraft);
  const [stepEditorOpen, setStepEditorOpen] = useState(false);
  // Pasos tal como estaban al abrir el editor del paso, para «Descartar».
  const [stepSnapshot, setStepSnapshot] = useState<ScenarioStep[] | null>(null);
  const [stepConfirm, setStepConfirm] = useState<"delete" | "discard" | "save" | null>(null);
  const selectedStep =
    value.steps.find((step) => step.id === selectedStepId) || value.steps[0];
  const flowGraph = useMemo(() => buildFlowGraph(value.steps), [value.steps]);
  // Curva de cada conexión y punto medio para su etiqueta.
  const edgeGeometry = (edge: (typeof flowGraph.edges)[number]) => {
    const source = flowGraph.positions.get(edge.from);
    const target = flowGraph.positions.get(edge.to);
    if (!source || !target) return null;
    const sx = source.x + NODE_WIDTH;
    const sy = source.y + Math.min(30 + edge.order * 16, NODE_HEIGHT - 14);
    const ex = target.x;
    const ey = target.y + 44;
    const backwards = ex <= sx;
    const c1 = backwards ? [sx + 60, sy + 140] : [sx + Math.max(50, (ex - sx) * 0.45), sy];
    const c2 = backwards ? [ex - 60, ey + 140] : [ex - Math.max(50, (ex - sx) * 0.45), ey];
    // Etiqueta un poco más cerca del destino para no tapar el botón «＋».
    const t = backwards ? 0.5 : 0.62;
    const at = (a: number, b: number, c: number, d: number) =>
      (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
    return {
      d: `M ${sx} ${sy} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${ex} ${ey}`,
      labelX: at(sx, c1[0], c2[0], ex),
      labelY: at(sy, c1[1], c2[1], ey),
    };
  };
  const triggerPreview = triggerText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const currentScenarioMedia: ReusableScenarioMedia[] = value.steps.flatMap(
    (step) =>
      step.type === "send_media"
        ? (step.items || []).map((item) => ({
            ...item,
            source: value.name.trim() || "Este escenario",
          }))
        : [],
  );
  const mediaLibrary = useMemo(
    () => [
      ...new Map(
        [...reusableMedia, ...currentScenarioMedia].map((item) => [
          item.mediaId,
          item,
        ]),
      ).values(),
    ],
    [reusableMedia, currentScenarioMedia],
  );
  const issueEntries = useMemo(
    () =>
      value.steps.flatMap((step, index) => ((): string[] => {
        const prefix = `Paso ${index + 1}`;
        if (step.type === "send_text" && !step.body?.trim())
          return [`${prefix}: falta el mensaje.`];
        if (step.type === "send_media" && !(step.items || []).length)
          return [`${prefix}: agrega al menos un archivo.`];
        if (step.type === "wait_reply" && !(step.branches || []).length)
          return [`${prefix}: agrega una respuesta posible.`];
        if (step.type === "send_options") {
          const problem = stepOptionsIssue(step);
          if (problem) return [`${prefix}: ${problem}`];
        }
        if (
          step.type === "wait_reply" &&
          (step.branches || []).some(
            (branch) =>
              !branch.name.trim() ||
              !branch.examples.some((example) => example.trim()) ||
              !branch.nextStepId,
          )
        )
          return [
            `${prefix}: completa el nombre, ejemplos y destino de cada respuesta.`,
          ];
        if (
          step.type === "budget_recommendation" &&
          (!(step.budgetOptions || []).length ||
            (step.budgetOptions || []).some(
              (option) =>
                (!(option.packageIds || []).length &&
                  !(option.items || []).length) ||
                !option.recommendationBody.trim(),
            ))
        )
          return [
            `${prefix}: agrega fotografías o paquetes y escribe la recomendación para cada presupuesto.`,
          ];
        if (step.type === "budget_recommendation" && !step.nextStepId)
          return [
            `${prefix}: elige el paso que continúa después de recomendar.`,
          ];
        if (
          [
            step.nextStepId,
            step.fallbackStepId,
            ...(step.branches || []).map((branch) => branch.nextStepId),
            ...(step.options || []).map((option) => option.nextStepId),
          ]
            .filter(Boolean)
            .some((id) => !value.steps.some((candidate) => candidate.id === id))
        )
          return [
            `${prefix}: hay una conexión que apunta a un paso eliminado.`,
          ];
        return [];
      })().map((text) => ({ id: step.id, text }))),
    [value.steps],
  );
  const issues = issueEntries.map((entry) => entry.text);
  const issueByStep = new Map(
    issueEntries.map((entry) => [entry.id, entry.text.replace(/^Paso \d+: /, "")]),
  );

  const updateStep = (id: string, patch: Partial<ScenarioStep>) =>
    setValue((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    }));
  // Older budget steps may have been saved before ranges were introduced, or
  // with an empty array. Give those steps a usable first range automatically.
  useEffect(() => {
    if (
      selectedStep?.type !== "budget_recommendation" ||
      selectedStep.budgetOptions?.length
    )
      return;
    updateStep(selectedStep.id, { budgetOptions: defaultBudgetOptions() });
  }, [
    selectedStep?.id,
    selectedStep?.type,
    selectedStep?.budgetOptions?.length,
  ]);
  const openStepEditor = (id: string) => {
    setStepSnapshot(value.steps);
    setSelectedStepId(id);
    setStepEditorOpen(true);
  };
  // La × solo cierra: los cambios quedan en el borrador del escenario.
  const closeStepEditor = () => {
    setStepEditorOpen(false);
    setStepConfirm(null);
  };
  const stepChanged =
    stepSnapshot !== null &&
    JSON.stringify(stepSnapshot) !== JSON.stringify(value.steps);
  const discardStepChanges = () => {
    if (stepSnapshot) {
      const restored = stepSnapshot;
      setValue((current) => ({ ...current, steps: restored }));
      if (!restored.some((step) => step.id === selectedStepId))
        setSelectedStepId(restored[0]?.id || "");
    }
    closeStepEditor();
  };
  const targetOptions = (currentId: string) =>
    value.steps.filter((step) => step.id !== currentId);
  const addStepAfter = (afterId: string | undefined, type: ScenarioStep["type"]) => {
    const step = blankStep(type);
    setStepSnapshot(value.steps);
    setValue((current) => ({
      ...current,
      steps: insertStepAfter(current.steps, afterId, step),
    }));
    setPickerFor(null);
    setSelectedStepId(step.id);
    setStepEditorOpen(true);
  };
  const removeStep = (id: string) => {
    if (value.steps.length <= 1) return;
    const remaining = value.steps
      .filter((step) => step.id !== id)
      .map((step) => ({
        ...step,
        nextStepId: step.nextStepId === id ? undefined : step.nextStepId,
        fallbackStepId:
          step.fallbackStepId === id ? undefined : step.fallbackStepId,
        branches: step.branches?.filter((branch) => branch.nextStepId !== id),
        options: step.options?.map((option) =>
          option.nextStepId === id ? { ...option, nextStepId: undefined } : option,
        ),
      }));
    setValue({ ...value, steps: remaining });
    setSelectedStepId(remaining[0]?.id || "");
    closeStepEditor();
  };
  const dropStep = (event: DragEvent<HTMLElement>, destinationId: string) => {
    event.preventDefault();
    const sourceId =
      event.dataTransfer.getData("text/merlynsales-scenario-step") ||
      draggingStepId;
    setDraggingStepId(null);
    if (!sourceId || sourceId === destinationId) return;
    setValue((current) => {
      const steps = [...current.steps];
      const from = steps.findIndex((step) => step.id === sourceId);
      const to = steps.findIndex((step) => step.id === destinationId);
      if (from < 0 || to < 0) return current;
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      return { ...current, steps };
    });
  };
  const uploadMedia = async (
    step: ScenarioStep,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      setError("Selecciona una imagen JPEG, PNG, WebP o un PDF.");
      return;
    }
    setError("");
    try {
      const response = await fetch(`${api}/scenarios/evidence/upload`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const uploaded = (await response.json().catch(() => ({}))) as {
        error?: string;
        mediaId?: string;
        filename?: string;
      };
      if (!response.ok)
        throw new Error(uploaded.error || "No fue posible subir el archivo.");
      if (!uploaded.mediaId)
        throw new Error("La carga no devolvió un identificador de archivo.");
      updateStep(step.id, {
        items: [
          ...(step.items || []),
          {
            mediaId: uploaded.mediaId,
            filename: uploaded.filename,
            type: file.type === "application/pdf" ? "document" : "image",
          },
        ],
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible subir el archivo.",
      );
    }
  };
  const addReusableMedia = (step: ScenarioStep, mediaId: string) => {
    const item = mediaLibrary.find(
      (candidate) => candidate.mediaId === mediaId,
    );
    if (
      !item ||
      (step.items || []).some((candidate) => candidate.mediaId === item.mediaId)
    )
      return;
    updateStep(step.id, {
      items: [
        ...(step.items || []),
        {
          mediaId: item.mediaId,
          filename: item.filename,
          caption: item.caption,
          type: item.type,
        },
      ],
    });
  };
  const saveScenario = async (closeSettings = false) => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(
        {
          ...value,
          aiDescription: value.aiDescription?.trim() || null,
          triggerExamples: triggerText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          steps: value.steps.map((step) => ({
            ...step,
            branches: step.branches?.map((branch) => ({
              ...branch,
              name: branch.name.trim(),
              aiDescription: branch.aiDescription?.trim() || undefined,
              examples: branch.examples
                .map((item) => item.trim())
                .filter(Boolean),
            })),
            options: step.options
              ?.filter((option) => option.title.trim())
              .map((option) => ({
                ...option,
                title: option.title.trim(),
                description: option.description?.trim() || undefined,
              })),
          })),
        },
        initial?.id,
      );
      if (closeSettings) setSettingsOpen(false);
      return true;
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "No fue posible guardar.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void saveScenario();
  };
  const branchEditor = (step: ScenarioStep) => (
    <div className="flow-branches">
      <strong>Si el cliente responde…</strong>
      <small>
        Las frases se comparan primero. Si no coinciden, la IA usa la
        descripción de significado para elegir una rama solo cuando tiene alta
        confianza.
      </small>
      {(step.branches || []).map((branch, branchIndex) => (
        <article key={branch.id}>
          <input
            value={branch.name}
            placeholder="Ej. Confirmó que abrió el catálogo"
            onChange={(event) => {
              const branches = [...(step.branches || [])];
              branches[branchIndex] = { ...branch, name: event.target.value };
              updateStep(step.id, { branches });
            }}
          />
          <textarea
            value={branch.aiDescription || ""}
            placeholder="Significado para la IA: el cliente confirma que pudo abrir, ver o consultar el catálogo correctamente."
            onChange={(event) => {
              const branches = [...(step.branches || [])];
              branches[branchIndex] = {
                ...branch,
                aiDescription: event.target.value,
              };
              updateStep(step.id, { branches });
            }}
          />
          <textarea
            value={branch.examples.join("\n")}
            placeholder="Frases conocidas que significan esta respuesta, una por línea"
            onChange={(event) => {
              const branches = [...(step.branches || [])];
              branches[branchIndex] = {
                ...branch,
                examples: event.target.value.split("\n"),
              };
              updateStep(step.id, { branches });
            }}
          />
          <label>
            Continuar en
            <select
              value={branch.nextStepId}
              onChange={(event) => {
                const branches = [...(step.branches || [])];
                branches[branchIndex] = {
                  ...branch,
                  nextStepId: event.target.value,
                };
                updateStep(step.id, { branches });
              }}
            >
              <option value="">Selecciona un paso…</option>
              {targetOptions(step.id).map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="danger-link"
            onClick={() =>
              updateStep(step.id, {
                branches: (step.branches || []).filter(
                  (candidate) => candidate.id !== branch.id,
                ),
              })
            }
          >
            Eliminar
          </button>
        </article>
      ))}
      <button
        type="button"
        className="plain-button"
        onClick={() => {
          const next = targetOptions(step.id)[0];
          const branch: ScenarioBranch = {
            id: `branch_${stepId()}`,
            name: "",
            aiDescription: "",
            examples: [],
            nextStepId: next?.id || "",
          };
          updateStep(step.id, { branches: [...(step.branches || []), branch] });
        }}
      >
        ＋ Agregar respuesta
      </button>
    </div>
  );
  const updateBudgetOption = (
    step: ScenarioStep,
    optionId: string,
    patch: Partial<ScenarioBudgetOption>,
  ) =>
    updateStep(step.id, {
      budgetOptions: (step.budgetOptions || []).map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    });
  const toggleBudgetPackage = (
    step: ScenarioStep,
    option: ScenarioBudgetOption,
    packageId: string,
  ) =>
    updateBudgetOption(step, option.id, {
      packageIds: (option.packageIds || []).includes(packageId)
        ? (option.packageIds || []).filter((id) => id !== packageId)
        : [...(option.packageIds || []), packageId],
    });
  const budgetImageLibrary = useMemo(() => {
    const savedImages: ReusableScenarioMedia[] = entrepreneurPackages.flatMap(
      (item) =>
        item.images.map((image) => ({
          mediaId: image.mediaId,
          filename: image.filename ?? undefined,
          caption: image.caption || item.caption || undefined,
          type: "image",
          source: `Imágenes guardadas · ${item.name}`,
        })),
    );
    return [
      ...new Map(
        [
          ...savedImages,
          ...mediaLibrary.filter((item) => item.type !== "document"),
        ].map((item) => [item.mediaId, item]),
      ).values(),
    ];
  }, [entrepreneurPackages, mediaLibrary]);
  const addBudgetImage = (
    step: ScenarioStep,
    option: ScenarioBudgetOption,
    mediaId: string,
  ) => {
    const item = budgetImageLibrary.find(
      (candidate) => candidate.mediaId === mediaId,
    );
    if (
      !item ||
      (option.items || []).some(
        (candidate) => candidate.mediaId === item.mediaId,
      )
    )
      return;
    updateBudgetOption(step, option.id, {
      items: [
        ...(option.items || []),
        {
          mediaId: item.mediaId,
          filename: item.filename,
          caption: item.caption,
          type: "image",
        },
      ],
    });
  };
  const uploadBudgetImage = async (
    step: ScenarioStep,
    option: ScenarioBudgetOption,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecciona una imagen JPEG, PNG o WebP.");
      return;
    }
    setError("");
    try {
      const response = await fetch(`${api}/scenarios/evidence/upload`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const uploaded = (await response.json().catch(() => ({}))) as {
        error?: string;
        mediaId?: string;
        filename?: string;
      };
      if (!response.ok || !uploaded.mediaId)
        throw new Error(uploaded.error || "No fue posible subir la imagen.");
      updateBudgetOption(step, option.id, {
        items: [
          ...(option.items || []),
          {
            mediaId: uploaded.mediaId,
            filename: uploaded.filename || file.name,
            type: "image",
          },
        ],
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible subir la imagen.",
      );
    }
  };
  const budgetEditor = (step: ScenarioStep) => (
    <div className="flow-branches budget-recommendation-editor">
      <strong>Paquetes para recomendar según el presupuesto</strong>
      <small>
        Agrega tantos rangos como necesites. Cada respuesta envía su texto, los
        paquetes elegidos y las fotografías individuales que configures.
      </small>
      {(step.budgetOptions || []).map((option) => (
        <article key={option.id}>
          <div className="budget-option-header">
            <strong>Rango de presupuesto</strong>
            <button
              type="button"
              className="danger-link"
              onClick={() =>
                updateStep(step.id, {
                  budgetOptions: (step.budgetOptions || []).filter(
                    (candidate) => candidate.id !== option.id,
                  ),
                })
              }
            >
              Eliminar rango
            </button>
          </div>
          <input
            value={option.label}
            placeholder="Nombre del rango"
            onChange={(event) =>
              updateBudgetOption(step, option.id, { label: event.target.value })
            }
          />
          <div className="budget-range-fields">
            <label>
              Mínimo
              <input
                type="number"
                min="0"
                value={option.min ?? ""}
                onChange={(event) =>
                  updateBudgetOption(step, option.id, {
                    min:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Máximo
              <input
                type="number"
                min="0"
                value={option.max ?? ""}
                placeholder="Sin límite"
                onChange={(event) =>
                  updateBudgetOption(step, option.id, {
                    max:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="budget-package-picker">
            <strong>Paquetes o conjuntos de fotos</strong>
            <small>
              Marca los paquetes que quieres recomendar. Vuelve a hacer clic
              para quitarlos; cada paquete enviará sus fotografías.
            </small>
            <div className="budget-package-options">
              {entrepreneurPackages.map((item) => {
                const selected = (option.packageIds || []).includes(item.id);
                return <label className={selected ? "selected" : ""} key={item.id}>
                  <input type="checkbox" checked={selected} onChange={() => toggleBudgetPackage(step, option, item.id)} />
                  <span><b>{item.name}</b><small>{item.images.length ? `${item.images.length} fotos` : "Sin fotos"}</small></span>
                </label>;
              })}
            </div>
            {!entrepreneurPackages.length && <small>Aún no hay paquetes ni conjuntos guardados.</small>}
          </div>
          <div className="budget-photo-picker">
            <label>
              Fotografías individuales
              <select
                defaultValue=""
                onChange={(event) => {
                  addBudgetImage(step, option, event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">Selecciona una imagen guardada…</option>
                {budgetImageLibrary
                  .filter(
                    (item) =>
                      !(option.items || []).some(
                        (selected) => selected.mediaId === item.mediaId,
                      ),
                  )
                  .map((item) => (
                    <option key={item.mediaId} value={item.mediaId}>
                      {item.filename || "Imagen"} · {item.source}
                    </option>
                  ))}
              </select>
            </label>
            <label className="media-button">
              ＋ Cargar fotografía nueva
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  void uploadBudgetImage(step, option, event)
                }
              />
            </label>
            {(option.items || []).length > 0 && (
              <div className="budget-selected-photos">
                {option.items?.map((item) => (
                  <span key={item.mediaId}>
                    ▧ {item.filename || "Imagen"}
                    <button
                      type="button"
                      onClick={() =>
                        updateBudgetOption(step, option.id, {
                          items: (option.items || []).filter(
                            (candidate) => candidate.mediaId !== item.mediaId,
                          ),
                        })
                      }
                      aria-label={`Quitar ${item.filename || "imagen"}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <textarea
            value={option.recommendationBody}
            placeholder="Mensaje de recomendación"
            onChange={(event) =>
              updateBudgetOption(step, option.id, {
                recommendationBody: event.target.value,
              })
            }
          />
        </article>
      ))}
      <button
        type="button"
        className="plain-button"
        onClick={() =>
          updateStep(step.id, {
            budgetOptions: [
              ...(step.budgetOptions || []),
              {
                id: `budget_${stepId()}`,
                label: "",
                examples: [],
                packageIds: [],
                items: [],
                recommendationBody: "",
              },
            ],
          })
        }
      >
        ＋ Agregar rango de presupuesto
      </button>
    </div>
  );

  return (
    <form className="flow-builder" onSubmit={submit}>
      <header className="flow-builder-header">
        <div>
          <p>ESCENARIO</p>
          <h1>
            {value.name || (initial ? "Escenario sin nombre" : "Nuevo escenario")}
          </h1>
          <span>
            {!initial && "Sin guardar · "}
            {value.steps.length} pasos ·{" "}
            {issues.length
              ? `${issues.length} detalle${issues.length === 1 ? "" : "s"} por revisar`
              : "Flujo listo para guardar"}
          </span>
          {saveError && (
            <p className="scenario-save-error" role="alert">
              <b>No se guardó.</b> {saveError} Tus cambios siguen aquí; corrige y
              vuelve a guardar.
            </p>
          )}
        </div>
        <div>
          <label className="scenario-active-toggle">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(event) =>
                setValue({ ...value, isActive: event.target.checked })
              }
            />{" "}
            Activo
          </label>
          <button className="primary-action" disabled={saving}>
            {saving ? "Guardando…" : "Guardar escenario"}
          </button>
        </div>
      </header>
      <div className="flow-settings-summary">
        <button
          type="button"
          className="flow-settings-trigger"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙ Configuración del escenario
        </button>
        <span>
          {triggerPreview.length ? (
            <>
              Inicia con{" "}
              {triggerPreview.slice(0, 3).map((item) => (
                <q key={item}>{item}</q>
              ))}
              {triggerPreview.length > 3 && ` y ${triggerPreview.length - 3} más`}
            </>
          ) : (
            "Aún no tiene frases de inicio."
          )}
        </span>
      </div>
      {settingsOpen && (
        <div
          className="scenario-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Configuración del escenario"
        >
          <button
            type="button"
            className="scenario-modal-backdrop"
            aria-label="Cerrar"
            onClick={() => setSettingsOpen(false)}
          />
          <section className="scenario-modal-card scenario-settings-modal">
            <header>
              <div>
                <p>ESCENARIO</p>
                <h2>Configuración</h2>
              </div>
              <button
                type="button"
                className="scenario-modal-close"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="flow-settings-modal-fields">
              <label>
                Nombre del escenario
                <input
                  value={value.name}
                  onChange={(event) =>
                    setValue({ ...value, name: event.target.value })
                  }
                  placeholder="Ej. Envíos nacionales"
                  required
                />
              </label>
              <label>
                Frases que inician el flujo
                <textarea
                  value={triggerText}
                  onChange={(event) => setTriggerText(event.target.value)}
                  placeholder={"Hacen envíos\nEnvían a Veracruz"}
                  required
                />
              </label>
              <label>
                Descripción para la IA
                <textarea
                  value={value.aiDescription || ""}
                  onChange={(event) =>
                    setValue({ ...value, aiDescription: event.target.value })
                  }
                  placeholder="Describe el propósito del escenario y qué preguntas debe reconocer."
                />
              </label>
              <label>
                Prioridad
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={value.priority}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      priority: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="scenario-active-toggle">
                <input
                  type="checkbox"
                  checked={value.canInterrupt}
                  onChange={(event) =>
                    setValue({ ...value, canInterrupt: event.target.checked })
                  }
                />{" "}
                Puede reemplazar otro escenario activo si coincide claramente
              </label>
            </div>
            <footer>
              {saveError && (
                <p className="scenario-save-error" role="alert">
                  <b>No se guardó.</b> {saveError}
                </p>
              )}
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={() => void saveScenario(true)}
              >
                {saving ? "Guardando…" : "Guardar y cerrar"}
              </button>
            </footer>
          </section>
        </div>
      )}
      <div className="flow-builder-layout">
        <section className="flow-canvas" aria-label="Flujo del escenario">
          <header>
            <div>
              <strong>Mapa del flujo</strong>
              <small>
                Toca una tarjeta para editarla o «＋» para agregar el siguiente
                paso ya conectado.
              </small>
            </div>
            <div className="flow-add">
              <span className="flow-legend" aria-hidden="true">
                <i className="direct" /> continúa <i className="branch" /> opción
                o respuesta
              </span>
              <div className="flow-add-anchor">
                <button
                  type="button"
                  className="plain-button"
                  aria-haspopup="menu"
                  aria-expanded={pickerFor === "toolbar"}
                  onClick={() =>
                    setPickerFor((open) => (open === "toolbar" ? null : "toolbar"))
                  }
                >
                  ＋ Agregar paso
                </button>
                {pickerFor === "toolbar" && (
                  <StepTypePicker
                    align="right"
                    title={
                      selectedStep
                        ? `Agregar después de «${selectedStep.label}»`
                        : "Agregar paso"
                    }
                    onClose={() => setPickerFor(null)}
                    onPick={(type) => addStepAfter(selectedStep?.id, type)}
                  />
                )}
              </div>
            </div>
          </header>
          {flowGraph.unreachable.size > 0 && (
            <p className="flow-warning" role="status">
              ⚠ {flowGraph.unreachable.size === 1
                ? "1 paso no está conectado"
                : `${flowGraph.unreachable.size} pasos no están conectados`}
              : ningún paso lleva a {flowGraph.unreachable.size === 1 ? "él" : "ellos"}, así que nunca se
              enviará{flowGraph.unreachable.size === 1 ? "" : "n"}. Conéctalo desde otro paso o elimínalo.
            </p>
          )}
          <div className="flow-map-viewport">
            <div
              className="flow-map"
              style={{ width: flowGraph.width, height: flowGraph.height }}
            >
              <svg
                className="flow-map-links"
                width={flowGraph.width}
                height={flowGraph.height}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="flow-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                </defs>
                {flowGraph.startId &&
                  (() => {
                    const first = flowGraph.positions.get(flowGraph.startId);
                    if (!first) return null;
                    const y = first.y + 44;
                    return (
                      <path
                        className="flow-map-link direct"
                        d={`M ${24 + START_WIDTH} ${y} L ${first.x} ${y}`}
                      />
                    );
                  })()}
                {flowGraph.edges.map((edge) => {
                  const geometry = edgeGeometry(edge);
                  if (!geometry) return null;
                  return (
                    <path
                      key={`${edge.from}-${edge.to}-${edge.kind}`}
                      className={`flow-map-link ${edge.kind}`}
                      d={geometry.d}
                    />
                  );
                })}
              </svg>
              {flowGraph.startId && (
                <div
                  className="flow-start-node"
                  style={{
                    left: 24,
                    top: flowGraph.positions.get(flowGraph.startId)?.y || 36,
                    width: START_WIDTH,
                  }}
                >
                  <b>▶ Inicio</b>
                  <small>Cuando el cliente escribe:</small>
                  {triggerPreview.length ? (
                    triggerPreview
                      .slice(0, 2)
                      .map((item) => <q key={item}>{item}</q>)
                  ) : (
                    <em>Sin frases de inicio</em>
                  )}
                  <button type="button" onClick={() => setSettingsOpen(true)}>
                    {triggerPreview.length > 2
                      ? `+${triggerPreview.length - 2} · Editar frases`
                      : "Editar frases"}
                  </button>
                </div>
              )}
              {flowGraph.edges.map((edge) => {
                const geometry = edgeGeometry(edge);
                if (!geometry || edge.kind === "direct") return null;
                return (
                  <span
                    key={`label-${edge.from}-${edge.to}-${edge.kind}`}
                    className={`flow-edge-label ${edge.kind}`}
                    style={{ left: geometry.labelX, top: geometry.labelY }}
                    title={edge.labels.join("\n")}
                  >
                    {edgeLabel(edge)}
                  </span>
                );
              })}
              {flowGraph.unreachable.size > 0 && (
                <div
                  className="flow-orphan-lane"
                  style={{ top: flowGraph.orphanTop, width: flowGraph.width }}
                >
                  Pasos sin conexión
                </div>
              )}
              {value.steps.map((step, index) => {
                const position = flowGraph.positions.get(step.id) || {
                  x: 44,
                  y: 48,
                };
                const unreachable = flowGraph.unreachable.has(step.id);
                const issue = issueByStep.get(step.id);
                const optionCount = (step.options || []).filter((option) =>
                  option.title.trim(),
                ).length;
                return (
                  <article
                    key={step.id}
                    className={`flow-map-node${selectedStep?.id === step.id ? " selected" : ""}${draggingStepId === step.id ? " dragging" : ""}${unreachable ? " unreachable" : ""}${issue ? " has-issue" : ""}${pickerFor === step.id ? " picker-open" : ""}`}
                    style={{ left: position.x, top: position.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Paso ${index + 1}: ${step.label}. ${labels[step.type]}. Editar`}
                    onClick={() => openStepEditor(step.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openStepEditor(step.id);
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropStep(event, step.id)}
                  >
                    <button
                      type="button"
                      className="flow-drag"
                      draggable
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/merlynsales-scenario-step",
                          step.id,
                        );
                        setDraggingStepId(step.id);
                      }}
                      onDragEnd={() => setDraggingStepId(null)}
                      title="Arrastra para cambiar el orden de la lista"
                      aria-label="Mover"
                    >
                      ⠿
                    </button>
                    <span className="flow-node-icon">{icons[step.type]}</span>
                    <div>
                      <small>
                        {index + 1} · {labels[step.type]}
                      </small>
                      <strong>{step.label}</strong>
                      <em>
                        {step.type === "send_text"
                          ? truncate(step.body, 52)
                          : step.type === "send_media"
                            ? `${(step.items || []).length} archivo${(step.items || []).length === 1 ? "" : "s"}`
                            : step.type === "wait_reply"
                              ? `${(step.branches || []).length} respuesta${(step.branches || []).length === 1 ? "" : "s"} posibles`
                              : step.type === "send_options"
                                ? `${optionCount} opci${optionCount === 1 ? "ón" : "ones"} · ${truncate(step.body, 30)}`
                                : step.type === "send_catalog"
                                  ? step.caption?.trim() || "Catálogo del negocio"
                                  : step.type === "budget_recommendation"
                                    ? `${(step.budgetOptions || []).length} rangos de presupuesto`
                                    : step.type === "move_column"
                                      ? `A «${columns.find((column) => column.id === step.columnId)?.name || "sin columna"}»`
                                      : "El escenario termina aquí"}
                      </em>
                      {(issue || unreachable) && (
                        <span className="flow-node-issue">
                          ⚠ {issue || "Ningún paso llega aquí"}
                        </span>
                      )}
                    </div>
                    {step.type !== "end" && (
                      <button
                        type="button"
                        className="flow-node-add"
                        aria-label={`Agregar paso después de ${step.label}`}
                        title="Agregar paso después"
                        aria-haspopup="menu"
                        aria-expanded={pickerFor === step.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedStepId(step.id);
                          setPickerAnchor(event.currentTarget.getBoundingClientRect());
                          setPickerFor((open) => (open === step.id ? null : step.id));
                        }}
                      >
                        ＋
                      </button>
                    )}
                    {pickerFor === step.id && (
                      <StepTypePicker
                        anchor={pickerAnchor}
                        title={`Después de «${step.label}»`}
                        note={
                          step.type === "send_options" &&
                          (step.options || []).every((option) => option.nextStepId)
                            ? "Todas las opciones ya tienen destino: el paso nuevo quedará sin conectar hasta que lo elijas en una opción."
                            : step.type === "wait_reply"
                              ? "Se agregará como una respuesta nueva; escribe sus frases en el paso «Esperar respuesta»."
                              : undefined
                        }
                        onClose={() => setPickerFor(null)}
                        onPick={(type) => addStepAfter(step.id, type)}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <aside
          className="flow-inspector flow-inspector-modal"
          data-open={stepEditorOpen}
          aria-label="Editor del paso"
        >
          {selectedStep ? (
            <>
              <header>
                <div>
                  <p>
                    <span className="flow-inspector-type" aria-hidden="true">
                      {icons[selectedStep.type]}
                    </span>
                    PASO{" "}
                    {value.steps.findIndex(
                      (step) => step.id === selectedStep.id,
                    ) + 1}{" "}
                    · {labels[selectedStep.type]}
                  </p>
                  <h2>{selectedStep.label}</h2>
                </div>
                <div className="flow-inspector-actions">
                  <button
                    type="button"
                    className="scenario-modal-close"
                    aria-label="Cerrar sin eliminar"
                    title="Cerrar (los cambios quedan en el borrador)"
                    onClick={closeStepEditor}
                  >
                    ×
                  </button>
                </div>
              </header>
              <label>
                Nombre visible del paso
                <input
                  value={selectedStep.label}
                  onChange={(event) =>
                    updateStep(selectedStep.id, { label: event.target.value })
                  }
                />
              </label>
              <label>
                Tipo de paso
                <select
                  value={selectedStep.type}
                  onChange={(event) => {
                    const type = event.target.value as ScenarioStep["type"];
                    updateStep(selectedStep.id, {
                      type,
                      label: labels[type],
                      body:
                        type === "send_text" || type === "send_options"
                          ? selectedStep.body || ""
                          : undefined,
                      ...(type === "send_options"
                        ? {
                            format: selectedStep.format || "auto",
                            buttonText:
                              selectedStep.buttonText ?? "Ver opciones",
                            options: selectedStep.options?.length
                              ? selectedStep.options
                              : optionDefaults().options,
                          }
                        : {
                            options: undefined,
                            header: undefined,
                            footer: undefined,
                            format: undefined,
                            buttonText: undefined,
                            sectionTitle: undefined,
                          }),
                      branches:
                        type === "wait_reply"
                          ? selectedStep.branches || []
                          : undefined,
                      budgetOptions:
                        type === "budget_recommendation"
                          ? selectedStep.budgetOptions || defaultBudgetOptions()
                          : undefined,
                      items:
                        type === "send_media"
                          ? selectedStep.items || []
                          : undefined,
                    });
                  }}
                >
                  {Object.entries(labels).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedStep.type === "send_text" && (
                <label>
                  Mensaje
                  <textarea
                    value={selectedStep.body || ""}
                    onChange={(event) =>
                      updateStep(selectedStep.id, { body: event.target.value })
                    }
                    placeholder="Escribe el mensaje que recibirá el cliente"
                  />
                  <span className="wa-preview" aria-label="Vista previa">
                    <small>Así lo verá el cliente</small>
                    <span className="wa-bubble">
                      {selectedStep.body?.trim() || "Escribe el mensaje…"}
                    </span>
                  </span>
                </label>
              )}
              {selectedStep.type === "send_catalog" && (
                <>
                  <label>
                    Mensaje que acompaña el catálogo
                    <textarea
                      value={selectedStep.caption || ""}
                      onChange={(event) =>
                        updateStep(selectedStep.id, {
                          caption: event.target.value,
                        })
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <span className="wa-preview" aria-label="Vista previa">
                    <small>Así lo verá el cliente</small>
                    <span className="wa-bubble wa-document">
                      <b>📄 Catálogo (PDF)</b>
                      {selectedStep.caption?.trim() && (
                        <span>{selectedStep.caption}</span>
                      )}
                    </span>
                  </span>
                  <label className="scenario-active-toggle">
                    <input
                      type="checkbox"
                      checked={selectedStep.resendCatalog === true}
                      onChange={(event) =>
                        updateStep(selectedStep.id, {
                          resendCatalog: event.target.checked,
                        })
                      }
                    />{" "}
                    Reenviar aunque ya exista en la conversación
                  </label>
                </>
              )}
              {selectedStep.type === "send_media" && (
                <div className="flow-media-picker">
                  <strong>Archivos de este paso</strong>
                  <div>
                    <label className="media-button">
                      ＋ Subir archivo nuevo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                        onChange={(event) => uploadMedia(selectedStep, event)}
                      />
                    </label>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        addReusableMedia(selectedStep, event.target.value);
                        event.target.value = "";
                      }}
                      disabled={
                        !mediaLibrary.some(
                          (item) =>
                            !(selectedStep.items || []).some(
                              (current) => current.mediaId === item.mediaId,
                            ),
                        )
                      }
                    >
                      <option value="">Reutilizar imagen o documento…</option>
                      {mediaLibrary
                        .filter(
                          (item) =>
                            !(selectedStep.items || []).some(
                              (current) => current.mediaId === item.mediaId,
                            ),
                        )
                        .map((item) => (
                          <option key={item.mediaId} value={item.mediaId}>
                            {item.type === "document" ? "PDF" : "Imagen"} ·{" "}
                            {item.filename || "Sin nombre"} · {item.source}
                          </option>
                        ))}
                    </select>
                  </div>
                  {(selectedStep.items || []).length === 0 ? (
                    <small>Aún no hay archivos para enviar.</small>
                  ) : (
                    selectedStep.items?.map((item) => (
                      <article key={item.mediaId}>
                        <span>{item.type === "document" ? "PDF" : "IMG"}</span>
                        <strong>{item.filename || item.mediaId}</strong>
                        <button
                          type="button"
                          className="danger-link"
                          onClick={() =>
                            updateStep(selectedStep.id, {
                              items: (selectedStep.items || []).filter(
                                (candidate) =>
                                  candidate.mediaId !== item.mediaId,
                              ),
                            })
                          }
                        >
                          Quitar
                        </button>
                      </article>
                    ))
                  )}
                </div>
              )}
              {selectedStep.type === "wait_reply" && (
                <>
                  <label>
                    Respuesta si no coincide con ninguna opción
                    <textarea
                      value={selectedStep.fallbackBody || ""}
                      onChange={(event) =>
                        updateStep(selectedStep.id, {
                          fallbackBody: event.target.value,
                        })
                      }
                      placeholder="Opcional. Si queda vacío, el lead pasa a Requiere atención."
                    />
                  </label>
                  {branchEditor(selectedStep)}
                </>
              )}
              {selectedStep.type === "send_options" && (
                <ScenarioOptionsStep
                  step={selectedStep}
                  targets={targetOptions(selectedStep.id)}
                  onChange={(patch) => updateStep(selectedStep.id, patch)}
                />
              )}
              {selectedStep.type === "budget_recommendation" && (
                <>
                  <label>
                    Respuesta si no entendió el presupuesto
                    <textarea
                      value={selectedStep.fallbackBody || ""}
                      onChange={(event) =>
                        updateStep(selectedStep.id, {
                          fallbackBody: event.target.value,
                        })
                      }
                      placeholder="Ej. ¿Me indica un monto aproximado para recomendarle el mejor paquete?"
                    />
                  </label>
                  {budgetEditor(selectedStep)}
                </>
              )}
              {selectedStep.type === "move_column" && (
                <label>
                  Columna de destino
                  <select
                    value={selectedStep.columnId || ""}
                    onChange={(event) =>
                      updateStep(selectedStep.id, {
                        columnId: event.target.value,
                      })
                    }
                  >
                    <option value="">No mover</option>
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!["wait_reply", "send_options", "end"].includes(selectedStep.type) && (
                <label>
                  Qué sigue después
                  <select
                    value={selectedStep.nextStepId || ""}
                    onChange={(event) =>
                      updateStep(selectedStep.id, {
                        nextStepId: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">
                      {selectedStep.type === "budget_recommendation"
                        ? "Selecciona el siguiente paso…"
                        : "Terminar después de este paso"}
                    </option>
                    {targetOptions(selectedStep.id).map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <footer className="flow-inspector-footer">
                {saveError && (
                  <p className="scenario-save-error" role="alert">
                    <b>No se guardó.</b> {saveError}
                  </p>
                )}
                <button
                  type="button"
                  className="flow-step-delete"
                  disabled={value.steps.length <= 1}
                  title={
                    value.steps.length <= 1
                      ? "El escenario necesita al menos un paso"
                      : undefined
                  }
                  onClick={() => setStepConfirm("delete")}
                >
                  Eliminar paso
                </button>
                <button
                  type="button"
                  className="plain-button"
                  onClick={() => setStepConfirm("discard")}
                >
                  Descartar
                </button>
                <button
                  type="button"
                  className="primary-action"
                  disabled={saving}
                  onClick={() => setStepConfirm("save")}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </footer>
            </>
          ) : (
            <div className="flow-empty">
              Selecciona un paso para configurarlo.
            </div>
          )}
        </aside>
      </div>
      <footer
        className={`flow-validation${issues.length ? " has-issues" : ""}`}
      >
        <div>
          <strong>
            {issues.length ? "Revisa antes de guardar" : "Flujo validado"}
          </strong>
          <span>
            {issues.length
              ? issues.join(" ")
              : "Todos los pasos requeridos tienen contenido y conexiones válidas."}
          </span>
        </div>
        {onCancel && (
          <button type="button" className="plain-button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="danger-link"
            onClick={() => void onDelete()}
          >
            Eliminar escenario
          </button>
        )}
      </footer>
      {error && <p className="scenario-error">{error}</p>}
      {selectedStep && (
        <>
          <ConfirmDialog
            open={stepConfirm === "delete"}
            tone="danger"
            title={`¿Eliminar el paso «${selectedStep.label}»?`}
            confirmLabel="Eliminar paso"
            onCancel={() => setStepConfirm(null)}
            onConfirm={() => {
              setStepConfirm(null);
              removeStep(selectedStep.id);
            }}
          >
            <p>
              Se quitará del flujo y las conexiones que llegan a él quedarán
              sin destino.
            </p>
            <p>
              El cambio se aplica al guardar el escenario; hasta entonces puedes
              cerrar sin guardar.
            </p>
          </ConfirmDialog>
          <ConfirmDialog
            open={stepConfirm === "discard"}
            tone="danger"
            title="¿Descartar los cambios de este paso?"
            confirmLabel="Descartar cambios"
            cancelLabel="Seguir editando"
            onCancel={() => setStepConfirm(null)}
            onConfirm={discardStepChanges}
          >
            <p>
              {stepChanged
                ? "Se perderá lo que cambiaste desde que abriste este paso" +
                  (stepSnapshot &&
                  !stepSnapshot.some((step) => step.id === selectedStep.id)
                    ? ", incluido el paso nuevo."
                    : ".")
                : "No hiciste cambios en este paso; solo se cerrará."}
            </p>
          </ConfirmDialog>
          <ConfirmDialog
            open={stepConfirm === "save"}
            title="¿Guardar el escenario?"
            confirmLabel="Guardar"
            busy={saving}
            onCancel={() => setStepConfirm(null)}
            onConfirm={async () => {
              const ok = await saveScenario();
              setStepConfirm(null);
              // Si falla, el editor sigue abierto con el error visible.
              if (ok) closeStepEditor();
            }}
          >
            <p>
              Se guardan todos los cambios del escenario, incluido este paso
              {value.isActive ? ", y se aplicarán a las conversaciones nuevas." : "."}
            </p>
            {issues.length > 0 && (
              <p>
                Hay {issues.length} detalle{issues.length === 1 ? "" : "s"} por
                revisar; si el servidor no lo acepta, verás el motivo aquí.
              </p>
            )}
          </ConfirmDialog>
        </>
      )}
    </form>
  );
}

const draftFromChoice = (choice: NewScenarioChoice): Draft => ({
  name: choice.name,
  isActive: choice.isActive,
  triggerExamples: choice.triggers,
  aiDescription: choice.aiDescription,
  priority: 0,
  canInterrupt: true,
  steps: instantiateSteps(choice.template, stepId),
});

export function ScenariosPanel({
  scenarios,
  columns,
  entrepreneurPackages,
  onSave,
  onDelete,
  onReorder,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    scenarios[0]?.id || null,
  );
  // false: sin crear · "start": eligiendo punto de partida · Draft: editando el nuevo.
  const [creating, setCreating] = useState<false | "start" | Draft>(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedId) || scenarios[0];
  const reusableMedia: ReusableScenarioMedia[] = scenarios.flatMap((scenario) =>
    scenario.steps.flatMap((step) =>
      step.type === "send_media"
        ? (step.items || []).map((item) => ({ ...item, source: scenario.name }))
        : [],
    ),
  );
  const dropScenario = async (
    event: DragEvent<HTMLButtonElement>,
    destinationId: string,
  ) => {
    event.preventDefault();
    const sourceId =
      event.dataTransfer.getData("text/merlynsales-scenario") || draggingId;
    setDraggingId(null);
    if (!sourceId || sourceId === destinationId || savingOrder) return;
    const ordered = [...scenarios];
    const from = ordered.findIndex((item) => item.id === sourceId);
    const to = ordered.findIndex((item) => item.id === destinationId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setSavingOrder(true);
    try {
      await onReorder(ordered.map((item) => item.id));
    } finally {
      setSavingOrder(false);
    }
  };
  return (
    <section className="scenario-studio">
      <header className="scenario-studio-header">
        <div>
          <p>ESCENARIOS</p>
          <h1>Constructor de flujos</h1>
          <span>
            Diseña conversaciones visualmente: elige un paso, conéctalo y
            configura solo lo necesario.
          </span>
        </div>
        <button
          className="plain-button scenario-library-toggle"
          type="button"
          onClick={() => setLibraryOpen((open) => !open)}
        >
          ☰ {libraryOpen ? "Ocultar escenarios" : "Escenarios"}
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            setCreating("start");
            setSelectedId(null);
          }}
        >
          ＋ Nuevo escenario
        </button>
      </header>
      <ScenarioCodexConnection />
      <div className="scenario-studio-layout" data-library-open={libraryOpen}>
        {libraryOpen && (
          <aside className="scenario-library">
            <header>
              <strong>Mis escenarios</strong>
              <small>Arrastra para definir prioridad</small>
            </header>
            {scenarios.length === 0 && !creating && (
              <p>Aún no hay escenarios. Crea el primero para comenzar.</p>
            )}
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                draggable
                className={`${selectedScenario?.id === scenario.id && !creating ? "selected" : ""}${draggingId === scenario.id ? " dragging" : ""}`}
                onClick={() => {
                  setSelectedId(scenario.id);
                  setCreating(false);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "text/merlynsales-scenario",
                    scenario.id,
                  );
                  setDraggingId(scenario.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void dropScenario(event, scenario.id)}
              >
                <span>⠿</span>
                <div>
                  <strong>{scenario.name}</strong>
                  <small>
                    {scenario.steps.length} pasos ·{" "}
                    {scenario.isActive ? "Activo" : "Pausado"}
                  </small>
                </div>
              </button>
            ))}
            {savingOrder && (
              <small className="scenario-order-saving">Guardando orden…</small>
            )}
          </aside>
        )}
        <div className="scenario-studio-editor">
          {creating === "start" ? (
            <NewScenarioStart
              onCancel={() => setCreating(false)}
              onCreate={(choice) => setCreating(draftFromChoice(choice))}
            />
          ) : creating ? (
            <FlowBuilder
              key="new"
              initialDraft={creating}
              columns={columns}
              entrepreneurPackages={entrepreneurPackages}
              reusableMedia={reusableMedia}
              onSave={async (draft) => {
                const saved = await onSave(draft);
                // Solo al guardar correctamente se cambia al escenario creado.
                if (saved?.id) setSelectedId(saved.id);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selectedScenario ? (
            <FlowBuilder
              key={selectedScenario.id}
              initial={selectedScenario}
              columns={columns}
              entrepreneurPackages={entrepreneurPackages}
              reusableMedia={reusableMedia}
              onSave={onSave}
              onDelete={async () => {
                if (!window.confirm(`¿Eliminar “${selectedScenario.name}”?`))
                  return;
                await onDelete(selectedScenario.id);
              }}
            />
          ) : (
            <div className="scenario-studio-empty">
              <b>Selecciona un escenario</b>
              <span>O crea uno nuevo para diseñar tu primer flujo.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
