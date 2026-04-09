// validation/signalSchema.js
import Joi from "joi";

export const signalSchema = Joi.object({
  symbol: Joi.string().required(),
  direction: Joi.string().valid("BUY", "SELL").required(),
  entry_price: Joi.number().positive().required(),
  stop_loss: Joi.number().required(),
  target_price: Joi.number().required(),
  entry_time: Joi.date().required(),
  expiry_time: Joi.date().greater(Joi.ref("entry_time")).required(),
});