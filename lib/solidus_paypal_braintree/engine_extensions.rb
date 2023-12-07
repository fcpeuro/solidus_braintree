# frozen_string_literal: true

module SolidusPaypalBraintree
  module EngineExtensions
    def self.included(engine)
      engine.extend ClassMethods

      engine.class_eval do
        Pathname.glob(solidus_decorators_root.join('*')) do |decorators_folder|
          config.autoload_paths += [decorators_folder]
        end

        config.to_prepare(&method(:activate))

        enable_solidus_engine_support('backend')
        enable_solidus_engine_support('frontend')
        enable_solidus_engine_support('api')
      end
    end

    module ClassMethods
      def activate
        load_solidus_decorators_from(solidus_decorators_root)
        load_solidus_subscribers_from(solidus_subscribers_root)
      end

      # Loads Solidus event subscriber files.
      #
      # This allows to add event subscribers to extensions without explicitly subscribing them,
      # similarly to what happens in Solidus core.
      def load_solidus_subscribers_from(path)
        if defined? Spree::Event
          Pathname.glob(path.join("**/*_subscriber.rb")) do |subscriber_path|
            require_dependency(subscriber_path)
          end

          if Spree::Event.respond_to?(:activate_all_subscribers)
            Spree::Event.activate_all_subscribers
          else
            Spree::Event.subscribers.each(&:subscribe!)
          end
        end
      end

      # Loads decorator files.
      #
      # This is needed since they are never explicitly referenced in the application code and
      # won't be loaded by default. We need them to be executed regardless in order to decorate
      # existing classes.
      def load_solidus_decorators_from(path)
        Pathname.glob(path.join('**/*.rb')) do |decorator_path|
          require_dependency(decorator_path)
        end
      end

      private

      # Returns the root for this engine's decorators.
      #
      # @return [Path]
      def solidus_decorators_root
        root.join('app/decorators')
      end

      # Returns the root for this engine's Solidus event subscribers.
      #
      # @return [Path]
      def solidus_subscribers_root
        root.join("app/subscribers")
      end

      # Enables support for a Solidus engine.
      #
      # This will tell Rails to:
      #
      #   * add +lib/controllers/[engine]+ to the controller paths;
      #   * add +lib/views/[engine]+ to the view paths;
      #   * load the decorators in +lib/decorators/[engine]+.
      #
      # @see #load_solidus_decorators_from
      def enable_solidus_engine_support(engine)
        paths['app/controllers'] << "lib/controllers/#{engine}"
        paths['app/views'] << "lib/views/#{engine}"

        path = root.join("lib/decorators/#{engine}")

        config.autoload_paths += Pathname.glob(path.join('*'))

        engine_context = self
        config.to_prepare do
          engine_context.instance_eval do
            load_solidus_decorators_from(path)
          end
        end
      end
    end
  end
end
