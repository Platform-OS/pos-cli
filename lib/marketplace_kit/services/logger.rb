module MarketplaceKit
  module Services
    class Logger
      def log_json_error(source)
        puts '```'.red
        puts 'Error while parsing JSON'.red
        puts "Raw body:\n#{source}"
        puts '```'.red
      end

      def log_api_error(message, details)
        puts '```'.red
        puts "Builder error: #{message}".red
        puts 'Details:'
        puts details
        puts '```'.red
      end

      def log_standard_error(error)
        puts '```'.red
        puts "Error: #{error.message} (#{error.class})".red
        puts '```'.red
      end
    end
  end
end
