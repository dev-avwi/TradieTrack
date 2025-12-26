import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Monitor } from "lucide-react";

import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";

type DeviceView = "mobile" | "web";

export default function DeviceShowcase() {
  const [activeView, setActiveView] = useState<DeviceView>("mobile");

  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-purple-400 via-blue-400 to-purple-300 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-full px-4 py-2 mb-6">
            <span className="text-sm font-semibold text-gray-700">Seamless across devices</span>
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
            Work from anywhere, stay in sync
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
            Whether you're on-site with your phone or at the office on your computer, TradieTrack keeps everything connected.
          </p>

          <div className="inline-flex bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setActiveView("mobile")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeView === "mobile"
                  ? "bg-black text-white shadow-sm"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
              data-testid="toggle-mobile-view"
            >
              <Smartphone className="w-4 h-4" />
              Mobile App
            </button>
            <button
              onClick={() => setActiveView("web")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeView === "web"
                  ? "bg-black text-white shadow-sm"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
              data-testid="toggle-web-view"
            >
              <Monitor className="w-4 h-4" />
              Web App
            </button>
          </div>
        </div>

        <div className="flex justify-center items-center min-h-[500px] lg:min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeView === "mobile" ? (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex justify-center"
              >
                <div className="relative w-[280px] sm:w-[300px]">
                  <div 
                    className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-2xl shadow-gray-400/30"
                  >
                    <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20" />
                    <div className="relative bg-white rounded-[2.25rem] overflow-hidden aspect-[9/19]">
                      <img 
                        src={jobsListScreenshot} 
                        alt="TradieTrack Mobile App - Jobs List"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="web"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex justify-center w-full max-w-4xl"
              >
                <div className="relative w-full">
                  <div className="bg-gray-800 rounded-t-xl pt-3 pb-2 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="bg-gray-700 rounded-md py-1.5 px-3 text-xs text-gray-400 text-center max-w-md mx-auto">
                          app.tradietrack.com.au
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-b-xl overflow-hidden shadow-2xl shadow-gray-400/30 aspect-[16/9]">
                    <img 
                      src={dashboardScreenshot} 
                      alt="TradieTrack Web Dashboard"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1/4 h-4 bg-gray-300 rounded-b-lg" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
