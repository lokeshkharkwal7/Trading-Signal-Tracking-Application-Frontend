import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { signalSchema } from "../../validations/signal-form";
import { createSignal } from "../../services/api";
import { getSymbolList } from "../../services/api";
import { useState, useEffect } from "react";
import Select from "react-select";
import toast from "react-hot-toast";

export default function SignalForm({ onSuccess }) {
  const [submitting, setSubmitting] = useState(false);

  const [symbolOptions, setSymbolOptions] = useState([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: joiResolver(signalSchema),
    defaultValues: {
      symbol: "",
      direction: "BUY",
      entry_price: "",
      stop_loss: "",
      target_price: "",
      entry_time: "",
      expiry_time: "",
    },
  });

  // ✅ Fetch symbols once
  useEffect(() => {
    const fetchSymbols = async () => {
      setLoadingSymbols(true);
      try {
        const symbols = await getSymbolList();
        console.log("symbols: ", symbols);

        const formatted = symbols.data.map((symbol) => ({
          label: symbol,
          value: symbol,
        }));

        setSymbolOptions(formatted);
      } catch (err) {
        toast.error(
          err.response?.data?.error || "Failed to load symbol list."
        );
      } finally {
        setLoadingSymbols(false);
      }
    };

    fetchSymbols();
  }, []);

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await createSignal({
        ...data,
        entry_price: Number(data.entry_price),
        stop_loss: Number(data.stop_loss),
        target_price: Number(data.target_price),
      });
      reset();
      toast.success("Signal created successfully!");
      onSuccess();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          "Failed to create signal. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200";

  const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-white mb-6">
        Create Signal
      </h2>



      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* ✅ SYMBOL SELECT */}
        <div>
          <label className={labelClass}>Symbol</label>
          <Controller
            name="symbol"
            control={control}
            render={({ field }) => (
              <Select
                options={symbolOptions}
                isLoading={loadingSymbols}
                placeholder="Search symbol..."
                onChange={(selected) =>
                  field.onChange(selected?.value)
                }
                value={
                  symbolOptions.find(
                    (opt) => opt.value === field.value
                  ) || null
                }
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: "rgba(51,65,85,0.5)",
                    borderColor: "rgba(71,85,105,0.5)",
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: "#1e293b",
                    color: "white",
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: "white",
                  }),
                  input: (base) => ({
                    ...base,
                    color: "white",
                  }),
                }}
              />
            )}
          />
          {errors.symbol && (
            <p className="mt-1 text-xs text-red-400">
              {errors.symbol.message}
            </p>
          )}
        </div>

        {/* Direction */}
        <div>
          <label className={labelClass}>Direction</label>
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <select {...field} className={inputClass}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            )}
          />
        </div>

        {/* Prices */}
        {[
          { name: "entry_price", label: "Entry Price" },
          { name: "stop_loss", label: "Stop Loss" },
          { name: "target_price", label: "Target Price" },
        ].map(({ name, label }) => (
          <div key={name}>
            <label className={labelClass}>{label}</label>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  step="any"
                  className={inputClass}
                />
              )}
            />
            {errors[name] && (
              <p className="mt-1 text-xs text-red-400">
                {errors[name].message}
              </p>
            )}
          </div>
        ))}

        {/* Time */}
        {["entry_time", "expiry_time"].map((name) => (
          <div key={name}>
            <label className={labelClass}>
              {name.replace("_", " ")}
            </label>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="datetime-local"
                  className={inputClass}
                />
              )}
            />
          </div>
        ))}

        {/* Submit */}
        <div className="col-span-full">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-500 text-white rounded-lg"
          >
            {submitting ? "Creating..." : "Create Signal"}
          </button>
        </div>
      </form>
    </div>
  );
}