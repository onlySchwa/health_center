import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { activeServices, getServices, type Service } from "@/lib/services";

const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const formatDays = (days: number[]) =>
  days.join() === "1,2,3,4,5" ? "Monday to Friday" : days.map((d) => dayNames[d]).join(", ");

// "Which days can I book?", from the services' days as admins set them (Admin → Health services).
// null = services couldn't be loaded: say how the calendar works without stating any days.
function bookingDaysAnswer(services: Service[] | null) {
  if (!services) return "Each service shows the days and times it's offered, and the booking calendar only lets you pick those.";
  if (services.length === 0) return "Online booking is paused right now. Please call or visit the health center.";
  const groups = new Map<string, string[]>();
  for (const s of services) {
    const days = formatDays([...s.days].sort());
    groups.set(days, [...(groups.get(days) ?? []), s.name]);
  }
  const days =
    groups.size === 1
      ? `${[...groups.keys()][0]}.`
      : [...groups].map(([d, names]) => `${names.join(", ")}: ${d}.`).join(" ");
  return `${days} The calendar only lets you pick the days and times each service is offered, and skips dates the health center has marked as closed.`;
}

// Answers describe how booking actually works on this site; keep them in step with it.
const faqs = (services: Service[] | null) => [
  {
    q: "How do I book an appointment?",
    a: "Fill in the booking form: your details, the service, a morning or afternoon slot and a date. It takes about a minute. You'll need to sign in first, and anything you've typed stays filled in.",
  },
  {
    q: "Do I need an account to book?",
    a: "Yes. Signing in lets us email you about your request and gives you a dashboard where you can see and cancel your appointments.",
  },
  {
    q: "How will I know my appointment is confirmed?",
    a: "Your request stays pending until the health center reviews it. We email you when it's confirmed, or if we can't accept it so you can choose another date.",
  },
  {
    q: "Which days can I book?",
    a: bookingDaysAnswer(services),
  },
  {
    q: "Can I cancel my appointment?",
    a: "Yes. Open My dashboard and cancel any upcoming appointment that's still pending or confirmed.",
  },
  {
    q: "What should I bring?",
    a: "Your confirmation email, to show at the front desk. Some services list what to bring when you choose them in the booking form.",
  },
];

// Frequently asked questions on the home page.
export async function FaqSection() {
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return null;
  });
  return (
    <section id="faq" aria-labelledby="faq-h" className="bg-baan-mist">
      <div className="mx-auto flex max-w-200 flex-col items-center gap-12 px-6 py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 id="faq-h" className="font-display text-[clamp(40px,5vw,60px)] leading-none font-extrabold text-baan-navy">
            FAQ
          </h2>
          <p className="text-lg text-baan-muted sm:text-xl">Have a question? We have answers.</p>
          <Link
            href="/contact"
            className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-baan-navy px-5 text-[15px] font-bold text-white transition-[translate] hover:-translate-y-px"
          >
            Contact us
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <Accordion className="gap-3 overflow-visible rounded-none border-0">
          {faqs(services).map((f) => (
            <AccordionItem
              key={f.q}
              value={f.q}
              className="rounded-2xl border-0 bg-white shadow-[0_1px_2px_rgba(14,59,74,0.05)] transition-shadow not-last:border-b-0 hover:shadow-[0_6px_18px_-10px_rgba(14,59,74,0.3)] data-open:bg-white"
            >
              <AccordionTrigger className="items-center px-6 py-5 text-base font-semibold text-baan-navy hover:no-underline focus-visible:ring-3 focus-visible:ring-baan-teal/30 **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-baan-muted">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5 text-base leading-relaxed text-baan-muted">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
