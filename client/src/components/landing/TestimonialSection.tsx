import { motion } from "framer-motion";

const featuredTestimonial = {
  quote: "TradieTrack is hands down the best tool I've used for running my trade business",
  name: "Mike Johnson",
  title: "Owner, Mike's Plumbing Services",
  initials: "MJ"
};

const testimonials = [
  {
    quote: "We used to juggle spreadsheets and paper invoices. Now everything's in one place - jobs, quotes, payments. Absolute game changer.",
    name: "Sarah Mitchell",
    title: "Electrical Contractor, Melbourne",
    initials: "SM"
  },
  {
    quote: "The mobile app is brilliant. I can create quotes on-site, get signatures, and send invoices before I've even left the job.",
    name: "Dave Thompson",
    title: "HVAC Specialist, Sydney",
    initials: "DT"
  },
  {
    quote: "Getting paid used to be a nightmare. Now clients pay online straight from the invoice. Cash flow has never been better.",
    name: "Jenny Wu",
    title: "Renovation Contractor, Brisbane",
    initials: "JW"
  },
  {
    quote: "Managing my team of 6 tradies was chaos before TradieTrack. Now I can see where everyone is and what they're working on.",
    name: "Tom Richards",
    title: "Carpentry Business Owner",
    initials: "TR"
  },
  {
    quote: "The GST reporting alone saves me hours every BAS quarter. My accountant loves it too.",
    name: "Lisa Chen",
    title: "Landscape Contractor, Perth",
    initials: "LC"
  }
];

function ProfileCircle({ initials }: { initials: string }) {
  return (
    <div 
      className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center text-white font-semibold text-sm"
      data-testid={`avatar-${initials.toLowerCase()}`}
    >
      {initials}
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: typeof testimonials[0] }) {
  return (
    <div 
      className="bg-white rounded-2xl p-6 shadow-sm min-w-[350px] max-w-[350px] flex flex-col"
      data-testid={`testimonial-card-${testimonial.initials.toLowerCase()}`}
    >
      <p className="text-gray-700 text-base leading-relaxed flex-1 mb-4">
        "{testimonial.quote}"
      </p>
      <div className="flex items-center gap-3">
        <ProfileCircle initials={testimonial.initials} />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
          <p className="text-gray-500 text-sm">{testimonial.title}</p>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialSection() {
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="py-20 md:py-28 overflow-hidden bg-gray-50">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16 md:mb-20"
        >
          <blockquote className="max-w-3xl mx-auto">
            <p 
              className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight"
              style={{ fontFamily: "Inter, sans-serif" }}
              data-testid="text-featured-quote"
            >
              "{featuredTestimonial.quote}"
            </p>
          </blockquote>
          
          <div className="flex items-center justify-center gap-4 mt-8">
            <ProfileCircle initials={featuredTestimonial.initials} />
            <div className="text-left">
              <p 
                className="font-semibold text-gray-900"
                data-testid="text-featured-name"
              >
                {featuredTestimonial.name}
              </p>
              <p 
                className="text-gray-500 text-sm"
                data-testid="text-featured-title"
              >
                {featuredTestimonial.title}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="relative"
      >
        <div 
          className="flex gap-6 testimonial-carousel hover:[animation-play-state:paused]"
          data-testid="testimonial-carousel"
        >
          {duplicatedTestimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={`${testimonial.initials}-${index}`} 
              testimonial={testimonial} 
            />
          ))}
        </div>
      </motion.div>

      <style>{`
        .testimonial-carousel {
          animation: scroll 30s linear infinite;
          width: max-content;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
