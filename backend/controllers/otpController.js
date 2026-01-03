const Otp = require("../models/Otp");
const sendSMS = require("../utils/sendSMS");
const OTP_VALIDITY_MINUTES = Number(process.env.OTP_VALIDITY_MINUTES);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS);


const generateOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOTP = async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: "Phone number required" });
    }

    try {
        const existingOtp = await Otp.findOne({ phone });

        // ⏱ Rate limit
        if (existingOtp) {
            const secondsSinceLast =
                (Date.now() - existingOtp.createdAt.getTime()) / 1000;

            if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
                return res.status(429).json({
                    message: `Please wait ${Math.ceil(
                        OTP_COOLDOWN_SECONDS - secondsSinceLast
                    )} seconds before requesting OTP again`
                });
            }

            // 🔁 RESEND same OTP if still valid
            console.log(
                `🔁 Resending OTP for ${phone}: ${existingOtp.otp} (valid for ${OTP_VALIDITY_MINUTES} minutes)`
            );

            await sendSMS(phone, existingOtp.otp);

            return res.status(200).json({
                message: `OTP resent. It is valid for ${OTP_VALIDITY_MINUTES} minutes`
            });
        }

        // 🆕 Generate new OTP
        const otp = generateOTP();

        await Otp.create({ phone, otp });

        console.log(
            `📩 OTP generated for ${phone}: ${otp} (valid for ${OTP_VALIDITY_MINUTES} minutes)`
        );

        await sendSMS(phone, otp);

        res.status(200).json({
            message: `OTP sent. It is valid for ${OTP_VALIDITY_MINUTES} minutes`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send OTP" });
    }
};

// VERIFY OTP
exports.verifyOTP = async (req, res) => {
    const { phone, otp } = req.body;

    try {
        const record = await Otp.findOne({ phone, otp });

        if (!record) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // OTP verified → delete
        await Otp.deleteMany({ phone });

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Verification failed" });
    }
};
