import { Badge, type BadgeType } from "~/components/shared/Badge";
import { Card } from "~/components/shared/Card";
import { formatSlotRange } from "~/components/shared/SchedulingShared";
import type { OverviewDto } from "~/core/services/schedulingQuery";

type Stage1Status = "not-started" | "complete";
type Stage2Status = "not-started" | "in-progress" | "no-agreement" | "complete";
type Stage3Status = "not-started" | "confirmed";

type BadgeConfig = { type: BadgeType; icon: BadgeType; label: string };

const stage1Config: Record<Stage1Status, BadgeConfig> = {
  "not-started": { type: "info", icon: "info", label: "Not started" },
  complete: { type: "success", icon: "success", label: "Done" },
};

const stage2Config: Record<Stage2Status, BadgeConfig> = {
  "not-started": { type: "info", icon: "info", label: "Not started" },
  "in-progress": { type: "warning", icon: "warning", label: "In progress" },
  "no-agreement": { type: "danger", icon: "danger", label: "No agreement" },
  complete: { type: "success", icon: "success", label: "Ready to confirm" },
};

const stage3Config: Record<Stage3Status, BadgeConfig> = {
  "not-started": { type: "info", icon: "info", label: "Not started" },
  confirmed: { type: "success", icon: "success", label: "Confirmed" },
};

function getStage1Status(overview: OverviewDto): Stage1Status {
  return overview.slots.length > 0 ? "complete" : "not-started";
}

function getStage2Status(overview: OverviewDto): Stage2Status {
  if (overview.slots.length === 0) return "not-started";
  if (overview.statuses.some((s) => s.isMutuallyAccepted)) return "complete";
  if (overview.hasSubmitted.KLAEGER && overview.hasSubmitted.BEKLAGTER)
    return "no-agreement";
  return "in-progress";
}

function TaskBadge(props: Readonly<BadgeConfig>) {
  return <Badge {...props} />;
}

export function RichterProcessSection({
  overview,
}: {
  readonly overview: OverviewDto;
}) {
  const stage1Status = getStage1Status(overview);
  const stage2Status = getStage2Status(overview);
  const stage3Status: Stage3Status = overview.finalSlotId
    ? "confirmed"
    : "not-started";
  const finalSlot = overview.slots.find((s) => s.id === overview.finalSlotId);

  return (
    <Card>
      <p className="mb-1 text-xs font-semibold tracking-widest text-slate-400 uppercase">
        Case
      </p>
      <div className="kern-task-list">
        <div className="kern-task-list__header">
          <h2 className="kern-heading-medium"> {overview.name}</h2>
        </div>
        <ul className="kern-task-list__list">
          <li className="kern-task-list__item">
            <span className="kern-number">1</span>
            <div className="kern-task-list__title" id="task1-title">
              <p className="kern-body">Create time slots</p>
              <div className="kern-task-list__status" id="task1-status">
                {" "}
                <TaskBadge {...stage1Config[stage1Status]} />
              </div>
            </div>
          </li>
          <li className="kern-task-list__item">
            <span className="kern-number">2</span>
            <div className="kern-task-list__title" id="task2-title">
              <p className="kern-body">Collect responses</p>
              <div className="kern-task-list__status" id="task2-status">
                {" "}
                <TaskBadge {...stage2Config[stage2Status]} />
              </div>
            </div>
          </li>
          <li className="kern-task-list__item">
            <span className="kern-number">3</span>
            <div className="kern-task-list__title">
              <div className="flex flex-col">
                <p className="kern-body">Confirm appointment</p>
                {finalSlot && (
                  <p className="kern-hint">
                    {formatSlotRange(
                      finalSlot.startsAtIso,
                      finalSlot.endsAtIso,
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="kern-task-list__status">
              <TaskBadge {...stage3Config[stage3Status]} />
            </div>
          </li>
        </ul>
      </div>
    </Card>
  );
}
