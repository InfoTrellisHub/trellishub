// Pure data: the chatbot's full menu-tree script. Every options[] array's last entry
// is always the "None of the above" escalation option — enforced by chatbot-engine.js
// at render time as a structural assertion, not just by convention here.
window.TRELLIS_CHATBOT_TREE = {
  root: {
    id: 'root',
    message: "Hi! I'm the Trellis assistant. How can I help you today?",
    options: [
      { label: 'Tell me about your services', next: 'services_overview' },
      { label: 'I want pricing info', next: 'pricing_overview' },
      { label: 'I want to book a consultation', next: 'booking_intent' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  services_overview: {
    id: 'services_overview',
    message: 'We build modern business websites and keep them running smoothly. What would you like to know?',
    options: [
      { label: "What's included in a website build?", next: 'services_detail' },
      { label: 'Do you offer ongoing maintenance?', next: 'care_plan_detail' },
      { label: "I'd like to see examples", next: 'portfolio_redirect' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  services_detail: {
    id: 'services_detail',
    message: 'A website build includes a custom design, mobile-responsive layout, contact form, and launch support. Want pricing or to book a call?',
    options: [
      { label: 'Show me pricing', next: 'pricing_redirect' },
      { label: 'Book a consultation', next: 'booking_intent' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  care_plan_detail: {
    id: 'care_plan_detail',
    message: 'The Care Plan covers Monthly Analytics Reports, Hosting, Maintenance, Upkeep, and Updates. Want to bundle it with a new build and save 20%?',
    options: [
      { label: 'Yes, tell me about bundling', next: 'pricing_redirect' },
      { label: 'I want to book this', next: 'booking_intent' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  portfolio_redirect: {
    id: 'portfolio_redirect',
    message: "We're actively building our showcase. I can scroll you to what we have, or connect you with the team directly for examples in your industry.",
    options: [
      { label: 'Show me the portfolio section', action: 'DEEPLINK_PORTFOLIO', next: 'closing' },
      { label: 'Connect me with the team', action: 'ESCALATE' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  pricing_overview: {
    id: 'pricing_overview',
    message: "Here's the short version: Essential Website is a once-off fee, or bundle it with our Care Plan and save 20% on the build. Want details?",
    options: [
      { label: 'Show me exact pricing', next: 'pricing_redirect' },
      { label: 'What does the Care Plan include?', next: 'care_plan_detail' },
      { label: 'I want a custom quote', next: 'booking_intent' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  pricing_redirect: {
    id: 'pricing_redirect',
    message: "I'll scroll you to our full pricing table with your local currency. Want to come back here afterward?",
    options: [
      { label: 'Show me pricing', action: 'DEEPLINK_PRICING', next: 'closing' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  booking_intent: {
    id: 'booking_intent',
    message: 'Great! What would you like to book?',
    options: [
      { label: 'Request a website quote', next: 'capture_contact_method', meta: { bookingType: 'quote' } },
      { label: 'Ask about the Care Plan', next: 'capture_contact_method', meta: { bookingType: 'care_plan' } },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  capture_contact_method: {
    id: 'capture_contact_method',
    message: 'How should we reach you?',
    options: [
      { label: 'Email', next: 'capture_email_value' },
      { label: 'Phone', next: 'capture_phone_value' },
      { label: 'Both', next: 'capture_email_value', meta: { thenCapture: 'phone' } },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  capture_email_value: {
    id: 'capture_email_value',
    message: "What's the best email to reach you on? Type it below.",
    inputType: 'text',
    captureField: 'email',
    validation: 'email',
    options: [
      { label: 'None of the above / talk to a human', action: 'ESCALATE' }
    ],
    next: 'capture_name_value'
  },

  capture_phone_value: {
    id: 'capture_phone_value',
    message: "What's the best number to reach you on? Type it below.",
    inputType: 'text',
    captureField: 'phone',
    validation: 'phone',
    options: [
      { label: 'None of the above / talk to a human', action: 'ESCALATE' }
    ],
    next: 'capture_name_value'
  },

  capture_name_value: {
    id: 'capture_name_value',
    message: 'And what name should we put on this?',
    inputType: 'text',
    captureField: 'name',
    options: [
      { label: 'None of the above / talk to a human', action: 'ESCALATE' }
    ],
    next: 'booking_handoff'
  },

  booking_handoff: {
    id: 'booking_handoff',
    message: "Thanks! I've noted that down. Want to pick a specific date/time now in our booking form, or should the team just call you?",
    options: [
      { label: 'Take me to the booking form', action: 'DEEPLINK_BOOKING', next: 'closing' },
      { label: 'Just have the team call me', action: 'STANDBY', next: 'closing' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  },

  closing: {
    id: 'closing',
    message: 'Perfect — thank you! Anything else I can help with?',
    options: [
      { label: 'Ask another question', next: 'root' },
      { label: 'None of the above', action: 'ESCALATE' }
    ]
  }
};

window.TRELLIS_CHATBOT_COPY = {
  escalate: "Thanks for reaching out — one of our team will personally follow up with you ASAP. In the meantime, feel free to keep browsing or reach us directly at info.trellishub@gmail.com.",
  standby: "Perfect — we've got your details and one of our team will call you ASAP.",
  startOver: 'Start over'
};
