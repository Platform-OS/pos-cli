module MarketplaceKit
  class CommandDispatcher
    extend Forwardable
    def_delegators :args_parser, :command_name, :command_args

    def initialize(args)
      @args = args
    end

    def execute
      command.new(command_args).execute
    rescue Errors::MarketplaceError => e
      puts e.message.red
    end

    private

    def command
      @command ||= case command_name
                   when 'sync'   then Commands::Sync
                   when 'deploy' then Commands::Deploy
                   when 'pull'   then Commands::Pull
                   when '--version', '-v' then Commands::ShowVersion
                   when '--help', '-h' then Commands::ShowHelp
                   else Commands::ShowHelp
                   end
    end

    def args_parser
      @args_parse ||= Services::ArgsParser.new @args
    end
  end
end
