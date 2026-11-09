/**
 * The Help Centre's questions and answers. One list feeds the Help page
 * (/help) and the support chat, so they always say the same thing.
 * Inside an answer, write apostrophes as ’ so the quotes stay valid.
 */

export const SUPPORT_EMAIL = 'support@abiaconnect.com'

export interface HelpLink {
  label: string
  to: string
}

export interface QA {
  q: string
  a: string
  /** A page that helps with this answer, shown as a button in the support chat. */
  link?: HelpLink
}

export const HELP_SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: 'Getting Started',
    items: [
      { q: 'How do I create an AbiaConnect account?', a: 'Click "Join Free" in the top navigation bar. Complete the two-step registration: enter your personal details, then pass the quick Abia State verification quiz. After registration, verify your email to activate your account.', link: { label: 'Join free', to: '/register' } },
      { q: 'Why do I need to verify I am from Abia State?', a: 'AbiaConnect is built for Abia State indigenes and friends of Abia. The verification step maintains the cultural identity and trust that make this community special. Non-indigenes who love Abia are welcome — select the non-indigene option during registration.' },
      { q: 'I did not receive my verification email. What should I do?', a: 'Check your spam or junk folder first. If it is not there, go to the Login page and click "Resend verification email." If problems persist, contact support@abiaconnect.com.', link: { label: 'Go to sign in', to: '/login' } },
    ],
  },
  {
    title: 'Posting and Threads',
    items: [
      { q: 'How do I start a new discussion thread?', a: 'Click "Start a Discussion" on the homepage or navigate to any category and click "New Thread." You must be logged in to post. Select a category, write a clear title, and add your content. Tags help others find your thread.' },
      { q: 'Can I edit or delete my post after publishing?', a: 'Yes. Click the three-dot menu on your post to edit or delete. Deleting a thread removes all replies — please consider this carefully before deleting.' },
      { q: 'What are pinned threads?', a: 'Pinned threads are placed at the top of a category by our moderation team because they contain important or especially useful information. Only administrators and moderators can pin threads.' },
    ],
  },
  {
    title: 'Account and Profile',
    items: [
      { q: 'How do I change my profile picture?', a: 'Go to Dashboard then Settings then Profile Picture. Click the upload area and select an image from your device. We recommend a square image at least 200x200 pixels in JPG, PNG, or WebP format.' },
      { q: 'Can I change my username?', a: 'Usernames can be changed once every 30 days. Go to Dashboard then Settings and update the username field. Your old username is released for others after 7 days.' },
      { q: 'How do I delete my account?', a: 'Go to Dashboard then Settings then Danger Zone. Click "Delete Account" and type DELETE to confirm. This is permanent. Contact support@abiaconnect.com within 14 days if you change your mind.', link: { label: 'How to delete your account', to: '/delete-account' } },
    ],
  },
  {
    title: 'Success Stories, Member of the Month and Events',
    items: [
      { q: 'How do I share a success story?', a: 'Open Success Stories (in the app’s More menu, or at the bottom of the website) and tap "Share a success story". Give it a headline, choose a topic and tell the story in your own words. Please only share true stories. Our team reads every story before it goes live, and you get a notification when it is published.', link: { label: 'Open Success Stories', to: '/success-stories' } },
      { q: 'How do I nominate someone for Member of the Month?', a: 'Open Member Spotlight (in the app’s More menu, or at the bottom of the website). Under "Nominate a member", type their username (you can find it on their profile, under their name) and say why they deserve it. You cannot nominate yourself. The team reads every nomination, and the member chosen gets a notification.', link: { label: 'Open Member Spotlight', to: '/member-spotlight' } },
      { q: 'How do I add an event to the Events Calendar?', a: 'Open Events (in the app’s More menu, or at the bottom of the website) and tap "Add an event". Give the name, date, start time, where it happens (or an online link starting with https://) and what happens there. The team checks every event before it is listed, and you get a notification when it is.', link: { label: 'Open Events', to: '/events' } },
      { q: 'How do I know if my story or event was published?', a: 'You get a notification when the team publishes it or decides not to. On the Success Stories, Member Spotlight and Events pages you will also see "What you sent in", with where each one stands and any note from the team.' },
      { q: 'Can I add an event to my phone calendar?', a: 'Yes. Under each event on the Events page, tap "Add to my calendar". It works with Google, Apple and Outlook calendars.', link: { label: 'Open Events', to: '/events' } },
    ],
  },
  {
    title: 'Polls, Contests and Elections',
    items: [
      { q: 'What is the difference between a poll and a contest?', a: 'A poll is a quick question to the whole community, like “Which topic should we talk about next?”. You tap an answer and see how everyone voted. A contest is a proper vote with a winner, like electing your town union’s officers or choosing Business of the Year. Contests use a secret ballot, have an opening and closing time, and only the right people can vote.', link: { label: 'See contests', to: '/contests' } },
      { q: 'How do I vote in a contest or election?', a: 'Open the contest from Contests in the menu, or from the notification or link you were sent. For each position, tap the person you want. Some positions let you pick more than one, and the page tells you how many. Then tap “Cast my vote”, check your choices and tap “Submit vote”. You can leave a position blank if you don’t want to vote for it.', link: { label: 'See contests', to: '/contests' } },
      { q: 'Is my contest vote secret?', a: 'Yes. AbiaConnect only records that you have voted, and separately what was voted, with nothing linking the two. Nobody can see who you voted for: not the organiser, not other members and not our admins.' },
      { q: 'Can I change my contest vote?', a: 'No. Like a paper ballot, once you submit, your vote is final. That is why we show you your choices one more time before you submit.' },
      { q: 'Why can’t I vote in a contest?', a: 'The page tells you the reason. The usual ones are: you are not a member of the group running it; you joined the group after the contest was created (organisers can switch this on so nobody brings in outsiders at the last minute); your account is too new; or voting has not opened yet or has already closed. If you were given a voter code, enter it on the contest page and you can vote with that.' },
      { q: 'What is a voter code?', a: 'A voter code is like a ballot paper. It is a short code such as K7QM-2XPA that the organiser gives you, often printed on a slip at a meeting. Open the contest, make your choices, type the code and submit. Each code works only once. You still need an AbiaConnect account to use it.' },
      { q: 'Can people outside the group follow an election?', a: 'Yes, if the organiser turned on “Anyone with the link can follow”. Then anyone, at home or abroad, can open the link to see who is standing, how many people have voted and, when allowed, the results. Only people allowed to vote can vote.' },
      { q: 'How are contest results announced?', a: 'When voting closes, everyone in the group, everyone who voted and the organiser get a notification that the results are out. The contest page shows the official result for each position. Tap “Save certificate as PDF” to get the official certificate, on the website or in the app, then save, print or share it. On the website you can also print it straight away. Anyone can share the results link. If two people tie for a place, the page says so and the organiser decides how to settle it.' },
      { q: 'How do I run an election or award for my group?', a: 'If you created a group, open Contests and tap “New”. Pick a ready-made template, for example a town union election, women’s or youth wing leaders, Business of the Year or Diaspora Abian of the Year, or fill in the form yourself. Add the people standing for each position, choose who can vote and when voting opens and closes. An admin checks your contest before it goes live, and your group gets a notification when it does.', link: { label: 'Start a contest', to: '/contests/new' } },
      { q: 'How do members at a meeting vote if they are not in the app group?', a: 'When you create the contest, tick “People with a voter code”. On the contest page, under Organiser tools, create as many codes as you need. Tap “Save slips as PDF” to get them as ballot slips, ready to print and hand out (on the website you can also print them straight away). Each code works once, and the page shows how many have been used.' },
    ],
  },
  {
    title: 'Volunteering',
    items: [
      { q: 'How do I volunteer with AbiaConnect?', a: 'Open Volunteer (at the bottom of the website, or in the app under More, then Careers), choose a role and answer a few short questions. We email you when we have looked at your application.', link: { label: 'Apply to volunteer', to: '/volunteer' } },
      { q: 'My application was approved. What happens next?', a: 'Your volunteer tools switch on by themselves, and you get a notification and an email saying what you can now do and where to find it. If you did not have an account yet, create one with the same email you applied with, and your tools switch on the first time you sign in.' },
      { q: 'Where do I find my volunteer tools?', a: 'Community Moderators and the content team will find "Moderator tools" in the app’s More menu, or under their profile picture on the website. Moderators review reported posts there; moderators and the content team review the success stories, events and Member of the Month nominations that members send in. Community Connectors become the champion of their LGA group and get an alert when someone new says hello there.', link: { label: 'Open Moderator tools', to: '/moderate' } },
      { q: 'What can volunteer moderators do?', a: 'They can hide a reported post that breaks the Community Standards, or keep it if it is fine. Hidden posts are never deleted and can be put back. Every decision is recorded, and our admins can undo any of them. Volunteers cannot change settings, money or anyone’s account.', link: { label: 'Community Standards', to: '/community-standards' } },
    ],
  },
  {
    title: 'Safety and Reporting',
    items: [
      { q: 'How do I report a post or user?', a: "Click the three-dot menu on any post or the flag icon on a user's profile. Select a reason and add details. Our team reviews every report within 24 hours.", link: { label: 'Community Standards', to: '/community-standards' } },
      { q: 'What happens after I report someone?', a: 'Our moderation team, which includes trained volunteer moderators, reviews the report. A post that breaks the Community Standards is hidden, and the person who wrote it gets a notification saying why. Serious or repeated problems can lead to a warning or a ban. Reports are confidential.' },
      { q: 'One of my posts was hidden. What can I do?', a: 'You will have a notification explaining that a moderator hid it. Hidden posts are not deleted: you can still see your own post, but other members cannot. If you think it was a mistake, tell us through Report a problem in the menu. If the team agrees, the post is put back and you get a notification.', link: { label: 'Report a problem', to: '/report-issue' } },
      { q: 'I am being harassed by another member. What should I do?', a: 'Report the posts using the Report button. You can also block the user from your profile settings. For severe harassment, email moderation@abiaconnect.com with screenshots.', link: { label: 'Report a problem', to: '/report-issue' } },
    ],
  },
]
