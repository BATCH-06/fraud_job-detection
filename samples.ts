export interface SampleCase {
  id: string;
  name: string;
  categoryBadge: 'Fraudulent' | 'Genuine' | 'Suspicious';
  companyName: string;
  jobTitle: string;
  senderInfo: string;
  channel: string;
  text: string;
  description: string;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: 'sample-task-telegram',
    name: 'Example 1: Telegram Video Watching Scam',
    categoryBadge: 'Fraudulent',
    companyName: 'Apex Media Global',
    jobTitle: 'Online Video Reviewer & Helper',
    senderInfo: 'recruiter-apex@gmail.com',
    channel: 'Telegram / WhatsApp',
    description: 'Promises easy money for liking videos, but demands a refundable fee upfront.',
    text: `URGENT HIRING FOR STUDENTS!
Role: Online Part-Time YouTube Video Reviewer & Data Entry Helper.
Work from home using your mobile phone for only 1 to 2 hours daily.
Earn ₹45,000 to ₹70,000 per month with daily payouts!
No resume, no qualification, and no prior experience needed. Freshers 100% accepted.
Direct selection! No interview required.
To activate your merchant review account and receive tasks, submit a 100% refundable security deposit of ₹2,500 to our verification account (UPI: apexpay@okhdfcbank).
Your deposit will be credited back along with your first daily task commission of ₹4,000.
Slots are strictly limited! Contact our Senior HR Coordinator on Telegram immediately: @apex_recruiter_official.`
  },
  {
    id: 'sample-internship-fee',
    name: 'Example 2: Fake Internship Demanding Laptop Fee',
    categoryBadge: 'Fraudulent',
    companyName: 'NextGen Cloud Technologies Pvt Ltd',
    jobTitle: 'Web Development Summer Intern',
    senderInfo: 'hr.nextgencloud@yahoo.com',
    channel: 'Email',
    description: 'Fake offer letter asking you to pay ₹3,800 for laptop courier insurance.',
    text: `Subject: Provisional Offer Letter - Summer Web Development Internship 2026
Dear Student,
Congratulations! Following an internal automated review of your profile, NextGen Cloud Technologies is pleased to offer you the position of Full-Stack Web Development Intern with a monthly stipend of ₹38,000.
Duration: 3 Months (Remote).
Immediate joining date: Next Monday.
Note: In accordance with our corporate device policy, you will be dispatched an Apple MacBook Air. To cover mandatory registration processing, government compliance certification, and courier insurance, you are required to remit a registration charge of ₹3,800 to our official finance desk within 24 hours.
Failure to pay within 24 hours will forfeit your allocated slot. Send transaction screenshot to hr.nextgencloud@yahoo.com.`
  },
  {
    id: 'sample-genuine-mnc',
    name: 'Example 3: Real Company Campus Placement Invitation',
    categoryBadge: 'Genuine',
    companyName: 'Tata Consultancy Services (TCS)',
    jobTitle: 'Graduate Software Trainee',
    senderInfo: 'campus.talent@tcs.com',
    channel: 'Official Campus Portal',
    description: 'A genuine recruitment invitation from an official company email with no fee requests.',
    text: `Dear Candidate,
Greetings from TCS Talent Acquisition Team.
We are pleased to invite you to the TCS Campus Hiring Technical Assessment for the batch of 2026.
Application Reference: TCS-DT-2026-9042
Assessment Date: Saturday, November 21, 2026
Venue / Mode: TCS iON Remote Proctored Platform
Role: Graduate Trainee (Digital Track)
CTC Package: 7.0 LPA - 9.0 LPA upon successful completion of technical rounds and managerial interview.
Security Notice: TCS does not ask candidates for any payments, security deposits, or registration charges at any stage of recruitment. Any communication requesting monetary transactions in exchange for job offers is unauthorized and fraudulent.
Please review the complete test guidelines and system readiness requirements on the official NextStep portal: https://nextstep.tcs.com.
Warm regards,
Campus Talent Acquisition, Tata Consultancy Services`
  },
  {
    id: 'sample-suspicious-yahoo',
    name: 'Example 4: Rushed Offer Asking for Identity Documents',
    categoryBadge: 'Suspicious',
    companyName: 'Starlight Digital Agency',
    jobTitle: 'Junior Marketing Assistant',
    senderInfo: 'starlight.hiring@hotmail.com',
    channel: 'Direct Email',
    description: 'Unknown recruiter using personal email who rushes you to send photos of your ID card.',
    text: `CONGRATULATIONS! You have been selected for the position of Junior Remote Marketing Assistant at Starlight Digital Agency.
Monthly Pay: $3,200 USD (Remote, Flexible Hours).
To finalize your employment contract before our quarterly payroll cutoff tonight, you must reply within 12 hours with scanned copies of your national identity card (front & back), passport photo, and utility bill for residential verification.
Due to high volume, offers not accepted within 12 hours will be permanently withdrawn.
Send documents to starlight.hiring@hotmail.com.`
  },
  {
    id: 'sample-crypto-remote',
    name: 'Example 5: Suspicious Cryptocurrency Job Offer',
    categoryBadge: 'Fraudulent',
    companyName: 'Quantum AI Research Labs',
    jobTitle: 'Remote AI Chat Evaluator',
    senderInfo: 'quantumai.jobs@gmail.com',
    channel: 'Telegram',
    description: 'Asks you to connect a crypto wallet and pay money to unlock job assignments.',
    text: `Earn $150 to $300 per day evaluating cutting-edge AI chatbots!
Quantum AI Research Labs is looking for English-speaking remote evaluators.
No formal degrees needed. Must possess an active Trust Wallet or Binance USDT (TRC-20) address.
To verify your node connection and secure high-value benchmarking prompts, candidates must link their wallet and stake 50 USDT as gas guarantee.
All funds remain in your custody and payouts are instant every evening in USDT.
Join our recruitment channel on Telegram: @quantum_ai_evaluators_desk.`
  }
];
