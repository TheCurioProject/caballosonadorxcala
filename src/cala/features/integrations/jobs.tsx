"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Badge,
  Empty,
} from "@/cala/components/ui/primitives";
import type { Job } from "@/cala/domain/model";
import { migrationSteps } from "@/cala/domain/migration/stages";
import { dateTime } from "@/cala/lib/format";
export function JobDetails({
  job,
  onClose,
}: {
  job: Job;
  onClose: () => void;
}) {
  const { command } = useWorkspace();
  const [excluded, setExcluded] = useState<string[]>(
    job.records
      .filter((r) => r.status === "conflict" || r.status === "excluded")
      .map((r) => r.externalId),
  );
  return (
    <Modal
      title={
        job.type === "migration"
          ? "Agente de importación"
          : "Detalle del proceso"
      }
      onClose={onClose}
      wide
    >
      <div className="row between">
        <Badge status={job.status} />
        <span className="muted">
          {job.progress}% · intento {job.attempts} / {job.maxAttempts}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Progreso del proceso"
        aria-valuenow={job.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: job.progress + "%" }} />
      </div>
      <p role="status">{job.message}</p>
      {job.type === "migration" && (
        <>
          <div className="job-steps">
            {migrationSteps.map((step, i) => (
              <div
                key={step}
                className={
                  "job-step " +
                  (i < job.step ? "done" : i === job.step ? "active" : "")
                }
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
          {job.records.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Incluir</th>
                    <th>Registro</th>
                    <th>Tipo</th>
                    <th>Estado / observación</th>
                  </tr>
                </thead>
                <tbody>
                  {job.records.map((r) => (
                    <tr key={r.externalId}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={"Incluir " + r.externalId}
                          checked={!excluded.includes(r.externalId)}
                          disabled={job.status !== "review"}
                          onChange={(e) =>
                            setExcluded((x) =>
                              e.target.checked
                                ? x.filter((id) => id !== r.externalId)
                                : [...x, r.externalId],
                            )
                          }
                        />
                      </td>
                      <td>
                        {r.externalId}
                        <small>
                          {Object.entries(r.payload)
                            .slice(0, 2)
                            .map(([, v]) => String(v))
                            .join(" · ")}
                        </small>
                      </td>
                      <td>{r.kind}</td>
                      <td>
                        <Badge
                          status={
                            r.status === "conflict"
                              ? "error"
                              : r.status === "imported"
                                ? "completed"
                                : "pending"
                          }
                        >
                          {r.status}
                        </Badge>
                        <small>{r.reason}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {job.status === "review" && (
            <Form
              fields={[]}
              submit="Aprobar e importar registros incluidos"
              onSubmit={async () => {
                await command({
                  type: "migration.review",
                  id: job.id,
                  excludeIds: excluded,
                });
              }}
            />
          )}
        </>
      )}
      {job.lastError && (
        <div className="notice error" role="alert">
          {job.lastError}
        </div>
      )}
      {["retry", "dead_letter"].includes(job.status) && (
        <button
          className="button primary"
          onClick={() =>
            void command({ type: "job.retry", id: job.id }).catch(() => {})
          }
        >
          Reintentar proceso
        </button>
      )}
      {job.result.length > 0 && (
        <div className="notice success">
          <div>
            {job.type === "report" ? (
              <>
                <p>{job.result.length - 1} filas listas para descargar.</p>
                <a
                  className="button secondary"
                  download={"reporte-" + job.id + ".csv"}
                  href={
                    "data:text/csv;charset=utf-8," +
                    encodeURIComponent(job.result.join("\n"))
                  }
                >
                  Descargar CSV
                </a>
              </>
            ) : (
              job.result.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        </div>
      )}
      {job.status === "completed" && job.type === "migration" && (
        <a
          className="button secondary"
          download={"importacion-" + job.id + ".json"}
          href={
            "data:application/json;charset=utf-8," +
            encodeURIComponent(
              JSON.stringify(
                {
                  id: job.id,
                  status: job.status,
                  result: job.result,
                  records: job.records.map((r) => ({
                    id: r.externalId,
                    status: r.status,
                    reason: r.reason,
                  })),
                },
                null,
                2,
              ),
            )
          }
        >
          <Icon name="download" />
          Descargar reporte técnico
        </a>
      )}
    </Modal>
  );
}
export function Jobs() {
  const { data, can } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const jobs = data.jobs
    .filter((j) => j.propertyId === data.currentPropertyId)
    .slice()
    .reverse();
  const selectedJob = data.jobs.find((j) => j.id === selected);
  return (
    <>
      <SectionTitle
        eyebrow="TODO SIGUE SU CURSO"
        title="Activity Center"
        description="Tus procesos continúan aunque cambies de pantalla o cierres el navegador."
      />
      <div className="panel">
        {jobs.length ? (
          jobs.map((j) => (
            <button
              className="list-row full"
              style={{
                background: "transparent",
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                textAlign: "left",
              }}
              key={j.id}
              onClick={() => setSelected(j.id)}
            >
              <div style={{ flex: 1 }}>
                <strong>
                  {j.type === "ical_import"
                    ? "Importación iCal"
                    : j.type === "migration"
                      ? "Importación de información"
                      : j.type === "channel_sync"
                        ? "Sincronización de canal"
                        : j.type === "report"
                          ? "Generación de reporte"
                          : j.type === "payment"
                            ? "Pago"
                            : "Automatización"}
                </strong>
                <p>{j.message}</p>
                <div className="progress-track" style={{ maxWidth: 300 }}>
                  <div
                    className="progress-fill"
                    style={{ width: j.progress + "%" }}
                  />
                </div>
                <small className="muted">
                  {dateTime(j.updatedAt)} · {j.progress}%
                </small>
              </div>
              <Badge status={j.status} />
              <Icon name="chevron-right" />
            </button>
          ))
        ) : (
          <Empty
            asset="import-progress"
            title="Sin procesos por ahora"
            description="Las importaciones, sincronizaciones, pagos y reportes aparecerán aquí."
          />
        )}
      </div>
      {can("audit.read") && (
        <div className="panel" style={{ marginTop: 25 }}>
          <div className="panel-heading">
            <h2>Auditoría de operaciones</h2>
          </div>
          {!data.audits.length && (
            <p className="muted audit-empty">
              Aún no hay cambios registrados. Cada acción del equipo aparecerá
              aquí con su autor y hora.
            </p>
          )}
          {data.audits
            .slice(-20)
            .reverse()
            .map((a) => (
              <div className="list-row" key={a.id}>
                <div>
                  <strong>{a.action}</strong>
                  <p>
                    {a.detail} ·{" "}
                    {data.users.find((u) => u.id === a.actorId)?.name ??
                      a.actorId}
                  </p>
                </div>
                <small className="muted">{dateTime(a.createdAt)}</small>
              </div>
            ))}
        </div>
      )}
      {selectedJob && (
        <JobDetails
          key={selectedJob.id}
          job={selectedJob}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
