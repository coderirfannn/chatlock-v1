import express from "express";
import webPush from 'web-push';
import dotenv from 'dotenv';
import User from "../../models/User.Model.js";

dotenv.config(); // Load environment variables

export const push = express.Router();

// Ensure VAPID keys exist
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error("❌ VAPID keys are missing in environment variables.");
    process.exit(1); // Stop the app
}

// ✅ Configure web-push VAPID keys
webPush.setVapidDetails(
    'mailto:your@email.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// ✅ Subscribe Route
push.post('/push/subscribe', async (req, res) => {
    try {
        const { userId } = req.user;
        const { subscription } = req.body;

        // Log the subscription to verify it contains the endpoint
        console.log('Received subscription:', subscription);

        // if (!subscription || !userId || !subscription.endpoint) {
        //     return res.status(400).json({ error: "Invalid subscription or missing endpoint." });
        // }

        // await User.findByIdAndUpdate(userId, {
        //     $set: { pushSubscription: subscription }
        // });

        if (subscription && subscription.endpoint) {
            // Valid subscription, proceed with sending the notification
            await webPush.sendNotification(subscription, JSON.stringify(payload));
        } else {
            console.warn(`⚠️ Invalid or missing endpoint for user ${userId}`);
            await User.findByIdAndUpdate(userId, {
                $unset: { pushSubscription: 1 }
            });
        }
        

        res.status(201).json({ success: true });
    } catch (err) {
        console.error("Subscribe error:", err);
        res.status(500).json({ error: "Failed to save subscription." });
    }
});


// export async function sendPushNotification(userId, payload) {
//     try {
//         const user = await User.findById(userId);
//         const subscription = user?.pushSubscription;

//         if (subscription && subscription.endpoint) {
//             try {
//                 await webPush.sendNotification(subscription, JSON.stringify(payload));
//             } catch (err) {
//                 console.error('❌ Push notification failed:', err);

//                 // Unsubscribe if expired or invalid
//                 if (err.statusCode === 410 || err.statusCode === 404) {
//                     await User.findByIdAndUpdate(userId, {
//                         $unset: { pushSubscription: 1 }
//                     });
//                 }
//             }
//         } else {
//             console.warn(`⚠️ No valid push subscription (missing endpoint) for user ${userId}`);
//         }
//     } catch (err) {
//         console.error("❌ Error sending push notification:", err.message);
//     }
// }
export async function sendPushNotification(userId, payload) {
    try {
        const user = await User.findById(userId);
        if (user?.pushSubscription) {
            const { pushSubscription } = user;
            
            // Ensure the pushSubscription object has the required fields
            if (!pushSubscription.endpoint) {
                console.warn(`⚠️ No endpoint found for user ${userId}. Removing subscription.`);
                await User.findByIdAndUpdate(userId, {
                    $unset: { pushSubscription: 1 }
                });
                return;
            }

            try {
                // Send notification only if endpoint exists
                await webPush.sendNotification(
                    pushSubscription,
                    JSON.stringify(payload)
                );
            } catch (err) {
                console.error('❌ Push notification failed:', err);
                // Remove invalid subscription
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await User.findByIdAndUpdate(userId, {
                        $unset: { pushSubscription: 1 }
                    });
                }
            }
        }
    } catch (err) {
        console.error("❌ Error sending push notification:", err.message);
    }
}
