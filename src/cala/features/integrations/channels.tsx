"use client";

import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Badge,
  Empty,
} from "@/cala/components/ui/primitives";
import { dateTime } from "@/cala/lib/format";
import { IcalPanel } from "./ical";

export function Channels() {
  const { data, can } = useWorkspace();
  const channels = data.channels.filter(
    (channel) => channel.propertyId === data.currentPropertyId,
  );
  return (
    <>
      <SectionTitle
        eyebrow="DISTRIBUCIÓN, BAJO CONTROL"
        title="Canales"
        description="Conexiones, mappings y sincronización en un mismo lugar."
      />
      <div className="card-grid">
        {channels.map((channel) => (
          <div className="card" key={channel.id}>
            <div className="row between">
              <Icon name="channels" size={29} />
              <Badge status={channel.status} />
            </div>
            <h3>{channel.name}</h3>
            <p>{channel.provider} · Distribución ARI</p>
            <dl className="details">
              <div>
                <dt>Mappings</dt>
                <dd>{channel.mappings.length}</dd>
              </div>
              <div>
                <dt>Fuente de verdad</dt>
                <dd>{channel.ownership === "pms" ? "CALA" : "Canal"}</dd>
              </div>
              <div>
                <dt>Última sincronización</dt>
                <dd>
                  {channel.lastSync
                    ? dateTime(channel.lastSync)
                    : "Sin sincronizar"}
                </dd>
              </div>
            </dl>
            {channel.lastError && (
              <div className="notice error">{channel.lastError}</div>
            )}
          </div>
        ))}
      </div>
      {!channels.length && (
        <Empty
          asset="channel-disconnected"
          title="Sin canales conectados"
          description="Las conexiones disponibles para tu cuenta aparecerán aquí."
        />
      )}
      {can("channel.manage") && <IcalPanel />}
    </>
  );
}
