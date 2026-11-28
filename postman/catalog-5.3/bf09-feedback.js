/**
 * BF-09 - Feedback Handling Flow
 * Sheet: "Feedback Handling Flow"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'Feedback Handling Flow',
  code: 'FEED',
  title: 'Feedback Handling',
  scenarios: [
    scenario('Scenario A - Submit a feedback ticket as member', [
      tc('FEED01', 'Test open the Feedback screen',
        [
          '1. Login with a MEMBER account',
          '2. Click the "Feedback" entry on the navigation sidebar',
        ],
        [
          '1. Display the "Feedback" screen',
          '2. Display the subtitle "Send your feedback or complaint. Every ticket goes to the content team first; system-level issues are escalated to the administrators."',
          '3. Display the "Submit new feedback" button',
        ],
        PRE.member),
      tc('FEED02', 'Test submit a new feedback ticket',
        [
          '1. Open the "Feedback" screen',
          '2. Click the "Submit new feedback" button',
          '3. Enter "Video scan freezes on my phone" in the "Title" field',
          '4. Enter the description in the "Content" field',
          '5. Select "Technical issue" in the "Category" dropdown',
          '6. Click the "Submit ticket" button',
        ],
        [
          '1. Display success message: "Your feedback has been sent. We will get back to you as soon as possible."',
          '2. Redirect to the ticket list',
          '3. The new ticket appears in the list with the status "Pending"',
        ],
        PRE.member),
      tc('FEED03', 'Test the feedback title is required',
        [
          '1. Open the "Submit new feedback" form',
          '2. Leave the "Title" field empty',
          '3. Enter the content and select a category',
          '4. Click the "Submit ticket" button',
        ],
        [
          '1. Display error message: "Please enter a title."',
          '2. No ticket is created',
        ],
        PRE.member),
      tc('FEED04', 'Test the feedback content is required',
        [
          '1. Open the "Submit new feedback" form',
          '2. Enter a title in the "Title" field',
          '3. Leave the "Content" field empty',
          '4. Click the "Submit ticket" button',
        ],
        [
          '1. Display error message: "Please enter the content of your feedback."',
          '2. No ticket is created',
        ],
        PRE.member),
      tc('FEED05', 'Test the feedback category is required',
        [
          '1. Open the "Submit new feedback" form',
          '2. Enter a title and a content',
          '3. Do not select a category',
          '4. Click the "Submit ticket" button',
        ],
        [
          '1. Display error message: "Please choose a category."',
          '2. No ticket is created',
        ],
        PRE.member),
      tc('FEED06', 'Test the member views the list of their own tickets',
        [
          '1. Open the "Feedback" screen',
          '2. Scroll down to the "Your tickets" section',
        ],
        [
          '1. Display the tickets submitted by the logged-in member',
          '2. Display the status of every ticket: "Pending", "In review", "Escalated to admin", "Resolved" or "Not accepted"',
          '3. Display the category of every ticket',
        ],
        PRE.member),
      tc('FEED07', 'Test the member filters the tickets by status',
        [
          '1. Open the "Feedback" screen',
          '2. Click the "Pending" filter of the ticket list',
        ],
        [
          '1. Display only the tickets with the "Pending" status',
          '2. The selected filter is highlighted in the filter bar',
        ],
        PRE.member),
      tc('FEED08', 'Test the empty state of the ticket list',
        [
          '1. Login with a MEMBER account that has never submitted a ticket',
          '2. Open the "Feedback" screen',
        ],
        [
          '1. Display "You have not submitted any tickets yet"',
          '2. Display the hint "Tap “Submit new feedback” to send your feedback or complaint to the management team."',
        ],
        PRE.member),
    ]),

    scenario('Scenario B - Handle a feedback ticket as content manager', [
      tc('FEED09', 'Test open the feedback queue of the content manager',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Feedback" entry of the content manager menu',
        ],
        [
          '1. Display the "Feedback overview" summary with the counts of the tickets per status',
          '2. Display the feedback list with the title, the member, the category and the status',
        ],
        PRE.cm),
      tc('FEED10', 'Test open the detail of a feedback ticket',
        [
          '1. Open the feedback queue of the content manager',
          '2. Click the "View" button of a ticket',
        ],
        [
          '1. Display the ticket title, the category, the status and the submission date',
          '2. Display the "Message" with the content written by the member',
          '3. Display the "Handle this ticket" section with the action buttons',
        ],
        PRE.cm),
      tc('FEED11', 'Test take a feedback ticket',
        [
          '1. Open the detail of a feedback ticket',
          '2. Click the "Take" button',
        ],
        [
          '1. Display success message: "You are now handling this ticket."',
          '2. The ticket is assigned to the content manager',
          '3. The ticket status changes to "In review"',
        ],
        PRE.cm),
      tc('FEED12', 'Test resolve a feedback ticket',
        [
          '1. Open the detail of a feedback ticket that the content manager has taken',
          '2. Click the "Resolve" button',
          '3. Enter "The video scan was fixed in the latest release." in the "Resolution note" field',
          '4. Click the "Confirm" button',
        ],
        [
          '1. Display success message: "The ticket was resolved and the status was returned to the member."',
          '2. The ticket status changes to "Resolved"',
          '3. The member receives a notification with the status and the resolution note',
        ],
        PRE.cm),
      tc('FEED13', 'Test escalate a system-level feedback ticket',
        [
          '1. Open the detail of a feedback ticket that the content manager has taken',
          '2. Click the "Escalate" button',
          '3. Enter "The failure comes from the pose analysis service." in the "Resolution note" field',
          '4. Click the "Confirm" button',
        ],
        [
          '1. Display success message: "The ticket was forwarded to the administrators."',
          '2. The ticket status changes to "Escalated to admin"',
          '3. The ticket appears in the escalated feedback queue of the administrator',
        ],
        PRE.cm),
      tc('FEED14', 'Test reject a feedback ticket',
        [
          '1. Open the detail of a feedback ticket that the content manager has taken',
          '2. Click the "Reject" button',
          '3. Enter "The report does not describe a defect of the platform." in the "Resolution note" field',
          '4. Click the "Confirm" button',
        ],
        [
          '1. Display success message: "The ticket was closed as not accepted."',
          '2. The ticket status changes to "Not accepted"',
          '3. The member receives a notification with the status and the reason',
        ],
        PRE.cm),
      tc('FEED15', 'Test filter the feedback queue by status and by category',
        [
          '1. Open the feedback queue of the content manager',
          '2. Select "In review" in the "Filter by status" dropdown',
          '3. Select "Technical issue" in the "Filter by category" dropdown',
        ],
        [
          '1. Display only the tickets matching the selected status and category',
          '2. Display "No ticket matches the current filters." when no ticket matches',
        ],
        PRE.cm),
      tc('FEED16', 'Test search the feedback queue',
        [
          '1. Open the feedback queue of the content manager',
          '2. Enter a keyword in the "Search by member name, email or title" field',
        ],
        [
          '1. Display only the tickets whose member name, email or title matches the keyword',
          '2. Display the updated row counter of the list',
        ],
        PRE.cm),
    ]),

    scenario('Scenario C - Handle an escalated ticket as administrator', [
      tc('FEED17', 'Test open the escalated feedback queue of the administrator',
        [
          '1. Login with an ADMIN account',
          '2. Click the "Feedback" entry of the admin menu',
        ],
        [
          '1. Display the list of the escalated feedback tickets',
          '2. Display the escalation date of every escalated ticket',
        ],
        PRE.admin),
      tc('FEED18', 'Test resolve an escalated feedback ticket',
        [
          '1. Open the escalated feedback queue of the administrator',
          '2. Open the detail of a ticket',
          '3. Click the "Resolve" button',
          '4. Enter "The pose analysis service was restarted and the issue is fixed." in the "Resolution note" field',
          '5. Click the "Confirm" button',
        ],
        [
          '1. Display success message: "The ticket was resolved and the status was returned to the member."',
          '2. The ticket status changes to "Resolved"',
          '3. The member receives a notification with the status and the resolution note',
        ],
        PRE.admin),
      tc('FEED19', 'Test reject an escalated feedback ticket',
        [
          '1. Open the escalated feedback queue of the administrator',
          '2. Open the detail of a ticket',
          '3. Click the "Reject" button',
          '4. Enter "The behaviour is the documented limitation of the free tier." in the "Resolution note" field',
          '5. Click the "Confirm" button',
        ],
        [
          '1. Display success message: "The ticket was closed as not accepted."',
          '2. The ticket status changes to "Not accepted"',
          '3. The member receives a notification with the status and the reason',
        ],
        PRE.admin),
      tc('FEED20', 'Test the member reads the resolution of a ticket',
        [
          '1. Login with the MEMBER account that submitted a resolved ticket',
          '2. Open the "Feedback" screen',
          '3. Open the resolved ticket',
        ],
        [
          '1. Display the "Resolution" section with the note written by the content manager',
          '2. Display the status "Resolved" on the ticket',
        ],
        PRE.member),
      tc('FEED21', 'Test a closed ticket cannot be handled again',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Open the detail of a ticket that has already been resolved',
        ],
        [
          '1. Display the notice "This ticket is closed. The member already received the result."',
          '2. The action buttons are not available',
        ],
        PRE.cm),
      tc('FEED22', 'Test the member is notified when the ticket status changes',
        [
          '1. Login with a MEMBER account',
          '2. Open the notification bell on the top bar',
        ],
        [
          '1. Display a notification with the new status of the ticket and the resolution note',
          '2. The unread count of the notification bell is incremented',
        ],
        PRE.member),
    ]),
  ],
};
