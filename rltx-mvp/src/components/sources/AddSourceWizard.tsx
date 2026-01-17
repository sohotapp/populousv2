"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Database,
  Table,
  GitBranch,
  Users,
  Loader2,
} from "lucide-react";
import { ConnectorBrowser } from "./ConnectorBrowser";
import { SourceConfigModal } from "./SourceConfigModal";
import { SchemaExplorer } from "./SchemaExplorer";
import { MappingBuilder } from "./MappingBuilder";
import { PopulationPreview } from "./PopulationPreview";
import { ConnectorLogo } from "../icons/ConnectorLogos";
import {
  useSourcesStore,
  type ConnectorDefinition,
  type SourceSchema,
  type FieldMapping,
  type PopulationIndex,
  type IndexedAgent,
} from "@/stores/sources";

// Design tokens - Linear grayscale only
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
};

type WizardStep = "connector" | "config" | "schema" | "mapping" | "build" | "done";

const STEPS: WizardStep[] = ["connector", "config", "schema", "mapping", "build"];

interface AddSourceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (sourceId: string, populationId: string) => void;
}

export function AddSourceWizard({ isOpen, onClose, onComplete }: AddSourceWizardProps) {
  const [step, setStep] = useState<WizardStep>("connector");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDefinition | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<SourceSchema[]>([]);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [population, setPopulation] = useState<PopulationIndex | null>(null);
  const [populationName, setPopulationName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createSource, discoverSchema, saveMappings, buildPopulation } = useSourcesStore();

  useEffect(() => {
    if (isOpen) {
      setStep("connector");
      setSelectedConnector(null);
      setSourceId(null);
      setSchemas([]);
      setSelectedStream(null);
      setMappings([]);
      setPopulation(null);
      setPopulationName("");
      setError(null);
    }
  }, [isOpen]);

  const handleConnectorSelect = (connector: ConnectorDefinition) => {
    setSelectedConnector(connector);
    setStep("config");
  };

  const handleConfigSubmit = async (data: { name: string; config: Record<string, string> }) => {
    if (!selectedConnector) return;
    setIsLoading(true);
    setError(null);
    try {
      const source = await createSource({
        name: data.name,
        connectorType: selectedConnector.id,
        config: data.config,
      });
      setSourceId(source.id);
      const discoveredSchemas = await discoverSchema(source.id);
      setSchemas(discoveredSchemas);
      if (discoveredSchemas.length > 0) {
        setSelectedStream(discoveredSchemas[0].streamName);
      }
      setStep("schema");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create source");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchemaNext = () => {
    if (!selectedStream || !schemas.length) return;
    setStep("mapping");
  };

  const handleSuggestMappings = async () => {
    if (!sourceId || !selectedStream) return [];
    const schema = schemas.find((s) => s.streamName === selectedStream);
    if (!schema) return [];
    try {
      const response = await fetch(`/api/sources/${sourceId}/mappings/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamName: selectedStream, fields: schema.fields }),
      });
      if (!response.ok) throw new Error("Failed to suggest mappings");
      return await response.json();
    } catch (err) {
      return [];
    }
  };

  const handleMappingNext = async () => {
    if (!sourceId || !selectedStream || mappings.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await saveMappings(sourceId, selectedStream, mappings);
      setStep("build");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mappings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildPopulation = async () => {
    if (!sourceId || !selectedStream || !populationName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const pop = await buildPopulation(sourceId, selectedStream, populationName);
      setPopulation(pop);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build population");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleAgents = async (count: number): Promise<IndexedAgent[]> => {
    if (!population) return [];
    try {
      const response = await fetch(`/api/populations/${population.id}/sample?count=${count}`);
      if (!response.ok) throw new Error("Failed to sample agents");
      return await response.json();
    } catch (err) {
      return [];
    }
  };

  const handleComplete = () => {
    if (sourceId && population) {
      onComplete?.(sourceId, population.id);
    }
    onClose();
  };

  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0 && step !== "done";
  const handleBack = () => {
    if (canGoBack) setStep(STEPS[stepIndex - 1]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Fixed size modal */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-lg overflow-hidden flex flex-col"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
          height: "600px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1 rounded transition-colors"
                style={{ color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
                {step === "done" ? "Population Ready" : "Connect Database"}
              </h2>
              <p className="text-[11px]" style={{ color: colors.textTertiary }}>
                {step === "connector" && "Choose a connector"}
                {step === "config" && selectedConnector?.name}
                {step === "schema" && "Select tables"}
                {step === "mapping" && "Map fields"}
                {step === "build" && "Build population"}
                {step === "done" && "Ready for simulations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: colors.textTertiary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {step === "connector" && (
            <ConnectorBrowser onSelect={handleConnectorSelect} selectedId={selectedConnector?.id} />
          )}

          {step === "config" && selectedConnector && (
            <SourceConfigModal
              connector={selectedConnector}
              isOpen={true}
              onClose={() => setStep("connector")}
              onSubmit={handleConfigSubmit}
            />
          )}

          {step === "schema" && schemas.length > 0 && (
            <div className="p-4">
              <SchemaExplorer
                schemas={schemas}
                selectedStream={selectedStream || undefined}
                onSelectStream={setSelectedStream}
              />
            </div>
          )}

          {step === "mapping" && selectedStream && schemas.find((s) => s.streamName === selectedStream) && (
            <div className="p-4">
              <MappingBuilder
                schema={schemas.find((s) => s.streamName === selectedStream)!}
                mappings={mappings}
                onMappingsChange={setMappings}
                onSuggestMappings={handleSuggestMappings}
              />
            </div>
          )}

          {step === "build" && (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: colors.textTertiary }}>
                  Population Name
                </label>
                <input
                  type="text"
                  value={populationName}
                  onChange={(e) => setPopulationName(e.target.value)}
                  className="w-full px-3 py-2 rounded text-[13px] outline-none"
                  style={{
                    background: colors.bgSurface,
                    border: `1px solid ${colors.borderDefault}`,
                    color: colors.textPrimary,
                  }}
                  placeholder={`${selectedConnector?.name} Customers`}
                />
              </div>
              <div className="p-3 rounded" style={{ background: colors.bgSurface }}>
                <div className="flex items-center gap-2 mb-2">
                  {selectedConnector && <ConnectorLogo connectorId={selectedConnector.id} className="w-4 h-4" />}
                  <span className="text-[12px]" style={{ color: colors.textSecondary }}>{selectedConnector?.name}</span>
                </div>
                <div className="text-[11px] space-y-1" style={{ color: colors.textTertiary }}>
                  <div>Stream: {selectedStream}</div>
                  <div>{mappings.length} fields mapped</div>
                </div>
              </div>
            </div>
          )}

          {step === "done" && population && (
            <div className="p-4">
              <PopulationPreview population={population} onSampleAgents={handleSampleAgents} />
            </div>
          )}

          {error && (
            <div className="mx-4 mb-4 p-2 rounded text-[12px]" style={{ background: "hsla(0, 70%, 55%, 0.1)", color: "hsl(0, 70%, 55%)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "config" && (
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
          >
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[12px] transition-colors"
              style={{ color: colors.textTertiary }}
              onMouseEnter={(e) => { e.currentTarget.style.color = colors.textSecondary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = colors.textTertiary; }}
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {step === "schema" && (
                <button
                  onClick={handleSchemaNext}
                  disabled={!selectedStream}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium"
                  style={{
                    background: selectedStream ? colors.textPrimary : colors.bgHover,
                    color: selectedStream ? colors.bgBase : colors.textQuaternary,
                  }}
                >
                  Continue <ChevronRight className="w-3 h-3" />
                </button>
              )}

              {step === "mapping" && (
                <button
                  onClick={handleMappingNext}
                  disabled={mappings.length === 0 || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium"
                  style={{
                    background: mappings.length > 0 && !isLoading ? colors.textPrimary : colors.bgHover,
                    color: mappings.length > 0 && !isLoading ? colors.bgBase : colors.textQuaternary,
                  }}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Continue <ChevronRight className="w-3 h-3" /></>}
                </button>
              )}

              {step === "build" && (
                <button
                  onClick={handleBuildPopulation}
                  disabled={!populationName.trim() || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium"
                  style={{
                    background: populationName.trim() && !isLoading ? colors.textPrimary : colors.bgHover,
                    color: populationName.trim() && !isLoading ? colors.bgBase : colors.textQuaternary,
                  }}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Build <Users className="w-3 h-3" /></>}
                </button>
              )}

              {step === "done" && (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium"
                  style={{ background: colors.textPrimary, color: colors.bgBase }}
                >
                  Done <Check className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
