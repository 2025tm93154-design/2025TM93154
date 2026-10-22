from pathlib import Path
import subprocess
import sys

report_dir = Path(r"C:\Users\sivam\Downloads\BootStrap 5\Restaurant Equipment Lending\Housekeeping System\reports")
report_path = report_dir / "Housekeeping_System_Report_Copyable.docx"
svg_path = report_dir / "Housekeeping_System_Architecture.svg"

try:
    import docx  # noqa: F401
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-docx"])

from docx import Document
from docx.shared import Pt


def build_architecture_svg(path: Path) -> Path:
    svg = '''
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420">
      <defs>
        <style>
          .title { font: 700 26px Arial, sans-serif; fill: #17324d; }
          .label { font: 600 18px Arial, sans-serif; fill: #17324d; }
          .small { font: 500 14px Arial, sans-serif; fill: #445d7a; }
          .box { fill: #edf3ff; stroke: #234c8f; stroke-width: 2; rx: 12; }
          .box2 { fill: #f7f9fc; stroke: #4c6f9f; stroke-width: 2; rx: 12; }
          .arrow { stroke: #234c8f; stroke-width: 3; fill: none; marker-end: url(#arrowhead); }
        </style>
        <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#234c8f" />
        </marker>
      </defs>
      <text x="500" y="40" class="title" text-anchor="middle">Housekeeping System Flow</text>

      <rect class="box2" x="40" y="90" width="180" height="180"/>
      <text class="label" x="130" y="145" text-anchor="middle">UI / Dashboard</text>
      <text class="small" x="130" y="175" text-anchor="middle">Submit request</text>
      <text class="small" x="130" y="200" text-anchor="middle">Refresh status</text>
      <text class="small" x="130" y="225" text-anchor="middle">Start / stop</text>

      <rect class="box" x="290" y="90" width="200" height="180"/>
      <text class="label" x="390" y="145" text-anchor="middle">Reservation</text>
      <text class="small" x="390" y="175" text-anchor="middle">Service</text>
      <text class="small" x="390" y="200" text-anchor="middle">Validate request</text>
      <text class="small" x="390" y="225" text-anchor="middle">Call room + task + notification</text>

      <rect class="box2" x="550" y="90" width="180" height="180"/>
      <text class="label" x="640" y="145" text-anchor="middle">Room</text>
      <text class="small" x="640" y="175" text-anchor="middle">Hold</text>
      <text class="small" x="640" y="200" text-anchor="middle">Capacity check</text>
      <text class="small" x="640" y="225" text-anchor="middle">Expiry handling</text>

      <rect class="box2" x="780" y="90" width="180" height="180"/>
      <text class="label" x="870" y="145" text-anchor="middle">Task</text>
      <text class="small" x="870" y="175" text-anchor="middle">Create task</text>
      <text class="small" x="870" y="200" text-anchor="middle">Idempotency key</text>
      <text class="small" x="870" y="225" text-anchor="middle">Replay-safe status</text>

      <rect class="box2" x="1010" y="90" width="150" height="180"/>
      <text class="label" x="1085" y="145" text-anchor="middle">Notification</text>
      <text class="small" x="1085" y="175" text-anchor="middle">Send update</text>
      <text class="small" x="1085" y="200" text-anchor="middle">Store message</text>
      <text class="small" x="1085" y="225" text-anchor="middle">Task reference</text>

      <line class="arrow" x1="220" y1="180" x2="290" y2="180"/>
      <line class="arrow" x1="490" y1="180" x2="550" y2="180"/>
      <line class="arrow" x1="730" y1="180" x2="780" y2="180"/>
      <line class="arrow" x1="960" y1="180" x2="1010" y2="180"/>

      <text class="small" x="250" y="150" text-anchor="middle">HTTP</text>
      <text class="small" x="520" y="150" text-anchor="middle">room hold</text>
      <text class="small" x="755" y="150" text-anchor="middle">task</text>
      <text class="small" x="985" y="150" text-anchor="middle">notify</text>
    </svg>
    '''
    path.write_text(svg.strip(), encoding="utf-8")
    return path


report_dir.mkdir(parents=True, exist_ok=True)
architecture_svg = build_architecture_svg(svg_path)


doc = Document()
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

doc.add_heading("Housekeeping System - Detailed Design and Engineering Report", 0)
doc.add_paragraph(
    "This report documents the implemented housekeeping microservices system, including architecture, service responsibilities, business rules, testing, outcome, and deployment status."
)

sections = [
    (
        "1. Problem and scope",
        "This project implements a small housekeeping reservation system for a hotel or serviced apartment operation. The main transaction is Reservation -> room hold -> housekeeping task -> notification. The design is intended for a local microservice assignment or demonstration environment, not a production hotel platform."
    ),
    (
        "2. Service decomposition",
        "Reservation Service manages the booking intent and orchestration. Room Service manages room availability, holds, and cleaning-slot capacity. Task Service owns housekeeping tasks and safety against duplicate task creation. Notification Service stores and logs outbound notifications."
    ),
    (
        "3. Architecture",
        "The system uses four independent services with separate SQLite databases and local HTTP endpoints. The UI calls the reservation service, which orchestrates room hold creation, task creation, and notification sending. The flow is validated through health checks and end-to-end service actions."
    ),
    (
        "4. Business rules",
        "BR1: cleaning-slot capacity is enforced under concurrent demand. BR2: requests with the same Idempotency-Key replay without duplicate effects. BR3: task creation is safe to replay and does not create duplicate tasks. BR4: notification creation is accepted only when valid task information is present."
    ),
    (
        "5. Testing and verification",
        "Fresh verification shows all service health endpoints responded successfully, the reservation flow returned a successful creation result, and the UI/report endpoints reported overall status = success. The system was tested via health checks, business-rule validation, and live call flows."
    ),
    (
        "6. Deployment and UI",
        "The project runs via npm start, launches the dashboard at http://localhost:4100, and exposes the four services on ports 3201-3204. The dashboard provides service selection and request controls, so the system can be exercised without shell commands."
    ),
    (
        "7. Design decisions",
        "The design uses synchronous orchestration for simplicity and visibility in a lab environment. Separate databases follow microservice ownership, while idempotency keys prevent duplicate side effects. The trade-off is that this is a local, simplified model rather than a full distributed transaction architecture."
    ),
    (
        "8. Limitations and future work",
        "The current design does not include full distributed transaction guarantees, a production auth layer, advanced monitoring, or event-driven queues. Future work could include outbox/event-driven integration, richer observability, and extended UI reporting."
    ),
]

for title, text in sections:
    doc.add_heading(title, level=1)
    doc.add_paragraph(text)

# Add a copy-friendly diagram section so the report includes an editable, text-based visual.
doc.add_heading("Architecture diagram (copy-friendly SVG)", level=1)
doc.add_paragraph(
    "The diagram below is generated as an SVG so the labels are preserved as editable text and can be copied more easily than a flattened screenshot."
)

try:
    doc.add_picture(str(architecture_svg), width=Pt(540))
except Exception:
    doc.add_paragraph(f"Vector diagram file: {architecture_svg.name} (copy-friendly SVG artifact generated in the reports folder)")

p = doc.add_paragraph()
r = p.add_run("Project status: Ready, running, and verified.")
r.bold = True

report_path.parent.mkdir(parents=True, exist_ok=True)
doc.save(report_path)
print(report_path)
print(architecture_svg)
